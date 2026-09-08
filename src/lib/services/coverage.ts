import { prisma } from "../prisma"
import { addDaysUTC, normalizeToUTCMidnight, toDateString } from "../timezone"

/**
 * Role-based coverage.
 *
 * Modelled on the operations spreadsheet: each day has coverage lines
 * (roles) such as "Outside Ops" and "Control Room", each with a minimum and a
 * target for days and for nights. Who counts toward a line is decided by:
 *
 *   1. the duty code on the schedule row — a custom code like OCR-D or PL-N
 *      maps to a shift half and a role, whatever the worker's home group; or
 *   2. a plain DAY / NIGHT row, which counts toward the default role of the
 *      worker's position group (Ops Techs → Outside Ops, OCR Ops → Control Room).
 *
 * Red below min, amber below target, green otherwise. `evaluateCoverageDay`
 * is pure so it can be tested; `findCoverage` loads the data.
 */

export type CoverageShift = "DAY" | "NIGHT"
export type CoverageStatus = "ok" | "amber" | "red"

export interface CoverageRoleDef {
  id: string
  name: string
  sortOrder: number
  minDay: number
  targetDay: number
  minNight: number
  targetNight: number
  requiredQualification?: string | null
}

export interface DutyCodeDef {
  code: string
  coverageShift: CoverageShift | null
  coverageRoleId: string | null
  isBackfill: boolean
}

export interface CoveragePerson {
  id: string
  name: string | null
  positionGroupId: string | null
  positionGroupName?: string | null
  rosterOrder?: number | null
  qualifications: string[]
}

export interface CoverageScheduleRow {
  date: Date
  shiftType: string
  customShiftCode: string | null
  user: CoveragePerson
}

export interface CoverageGroupDef {
  id: string
  name: string
  sortOrder: number
  defaultCoverageRoleId: string | null
}

export interface RosterEntry {
  userId: string
  name: string
  /** What put them here: "DAY", "NIGHT" or a duty code */
  via: string
  isBackfill: boolean
  /** The worker lacks the role's required qualification */
  unqualified: boolean
}

/** "This role needs N distinct holders of this sign-off on this shift." */
export interface CoverageRequirementDef {
  coverageRoleId: string
  code: string
  name: string
  countDay: number
  countNight: number
  /**
   * Who may stand in when nobody holding `code` is left, in order of
   * preference. A stand-in fills the position, but only after every real
   * holder is used, and the result says it was a stand-in.
   */
  fallbackCodes?: string[]
}

/** How one sign-off requirement came out on a given line. */
export interface SignOffCoverage {
  code: string
  name: string
  need: number
  filled: number
  /**
   * Who was assigned to it — each person appears against at most one sign-off.
   * `standingIn` is the sign-off they actually hold, when they are covering
   * this position rather than being signed off on it.
   */
  by: { userId: string; name: string; standingIn?: string }[]
  /** How many of `filled` are stand-ins */
  standIns: number
}

export interface RoleShiftCoverage {
  roleId: string
  roleName: string
  shift: CoverageShift
  have: number
  min: number
  target: number
  status: CoverageStatus
  roster: RosterEntry[]
  /** Empty when the role has no sign-off requirements */
  signOffs: SignOffCoverage[]
  /** True when the headcount is fine but the sign-offs cannot all be filled */
  signOffShortfall: boolean
  /** How many positions on this line are held by a stand-in */
  standIns: number
}

/**
 * Maximum bipartite matching (Kuhn's algorithm) between sign-off slots and
 * the people on shift.
 *
 * This is the "one person can only do one job" rule, and it is why counting
 * is not enough. Count holders per sign-off and a shift passes where a single
 * operator holds oil *and* gas while nobody else holds either — but they
 * cannot be in two places, so the shift is genuinely short. Matching each
 * slot to a distinct person is the only way to answer correctly.
 *
 * Slots and people are both single digits here, so the simple augmenting
 * path algorithm is comfortably fast enough.
 *
 * @returns for each slot, the index of the person assigned to it, or null.
 */
export function matchSignOffs(
  slots: { code: string; fallbackCodes?: string[] }[] | string[],
  people: { qualifications: string[] }[]
): (number | null)[] {
  // Accept a plain list of codes as well, which is all most roles need
  const spec = slots.map((s) => (typeof s === "string" ? { code: s, fallbackCodes: [] as string[] } : { code: s.code, fallbackCodes: s.fallbackCodes ?? [] }))

  const slotOf: (number | null)[] = people.map(() => null) // person → slot
  const personOf: (number | null)[] = spec.map(() => null) // slot → person

  const holds = (p: number, code: string) => people[p].qualifications.some((q) => q.toUpperCase() === code.toUpperCase())
  const acceptable = (slot: number, p: number, allowFallbacks: boolean) =>
    holds(p, spec[slot].code) || (allowFallbacks && spec[slot].fallbackCodes.some((c) => holds(p, c)))

  const augment = (slot: number, seen: boolean[], allowFallbacks: boolean): boolean => {
    for (let p = 0; p < people.length; p++) {
      if (seen[p] || !acceptable(slot, p, allowFallbacks)) continue
      seen[p] = true
      // Take this person if they are free, or if whoever has them can be
      // re-housed in another slot.
      const current = slotOf[p]
      if (current === null || augment(current, seen, allowFallbacks)) {
        slotOf[p] = slot
        personOf[slot] = p
        return true
      }
    }
    return false
  }

  // Two passes, and the order is the point. The first uses only people who
  // genuinely hold the sign-off, so every real holder is placed before any
  // stand-in is considered. The second fills whatever is still empty, now
  // allowing stand-ins. Doing it in one pass would let a stand-in take a
  // position that a qualified operator could have filled.
  for (let s = 0; s < spec.length; s++) augment(s, people.map(() => false), false)
  for (let s = 0; s < spec.length; s++) {
    if (personOf[s] === null) augment(s, people.map(() => false), true)
  }
  return personOf
}

/** Resolve a line's sign-off requirements against the people counted on it. */
function evaluateSignOffs(
  requirements: CoverageRequirementDef[],
  shift: CoverageShift,
  counted: RosterEntry[],
  qualificationsOf: Map<string, string[]>
): SignOffCoverage[] {
  // Expand "2 × oil operator" into two slots, so matching stays one-to-one
  const slots: { code: string; name: string; fallbackCodes: string[] }[] = []
  for (const req of requirements) {
    const need = shift === "DAY" ? req.countDay : req.countNight
    const fallbackCodes = (req.fallbackCodes ?? []).map((c) => c.toUpperCase())
    for (let i = 0; i < need; i++) slots.push({ code: req.code.toUpperCase(), name: req.name, fallbackCodes })
  }
  if (slots.length === 0) return []

  const people = counted.map((r) => ({ qualifications: qualificationsOf.get(r.userId) ?? [] }))
  const assignment = matchSignOffs(slots, people)

  const out = new Map<string, SignOffCoverage>()
  slots.forEach((slot, i) => {
    const entry = out.get(slot.code) ?? { code: slot.code, name: slot.name, need: 0, filled: 0, by: [], standIns: 0 }
    entry.need += 1
    const p = assignment[i]
    if (p !== null) {
      entry.filled += 1
      const held = qualificationsOf.get(counted[p].userId) ?? []
      const reallyHolds = held.some((q) => q.toUpperCase() === slot.code)
      const standingIn = reallyHolds ? undefined : slot.fallbackCodes.find((c) => held.some((q) => q.toUpperCase() === c))
      if (standingIn) entry.standIns += 1
      entry.by.push({ userId: counted[p].userId, name: counted[p].name, standingIn })
    }
    out.set(slot.code, entry)
  })
  return Array.from(out.values())
}

export interface DayCoverage {
  date: string
  lines: RoleShiftCoverage[]
  /** Worst status across all lines */
  status: CoverageStatus
}

function statusFor(have: number, min: number, target: number): CoverageStatus {
  if (have < min) return "red"
  if (have < Math.max(min, target)) return "amber"
  return "ok"
}

/**
 * Decide which (role, shift) a schedule row contributes to, if any.
 */
export function classifyRow(
  row: CoverageScheduleRow,
  groupsById: Map<string, CoverageGroupDef>,
  codesByCode: Map<string, DutyCodeDef>
): { roleId: string; shift: CoverageShift; via: string; isBackfill: boolean } | null {
  if (row.shiftType === "CUSTOM" && row.customShiftCode) {
    const code = codesByCode.get(row.customShiftCode.toUpperCase())
    if (!code || !code.coverageShift || !code.coverageRoleId) return null
    return { roleId: code.coverageRoleId, shift: code.coverageShift, via: code.code, isBackfill: code.isBackfill }
  }
  if (row.shiftType === "DAY" || row.shiftType === "NIGHT" || row.shiftType === "PL_DAY" || row.shiftType === "PL_NIGHT") {
    const group = row.user.positionGroupId ? groupsById.get(row.user.positionGroupId) : undefined
    if (!group?.defaultCoverageRoleId) return null
    const shift: CoverageShift = row.shiftType === "DAY" || row.shiftType === "PL_DAY" ? "DAY" : "NIGHT"
    return { roleId: group.defaultCoverageRoleId, shift, via: row.shiftType, isBackfill: false }
  }
  return null
}

/** Evaluate one calendar day. `rows` must all be on `date`. */
export function evaluateCoverageDay(
  date: Date,
  rows: CoverageScheduleRow[],
  roles: CoverageRoleDef[],
  groups: CoverageGroupDef[],
  dutyCodes: DutyCodeDef[],
  requirements: CoverageRequirementDef[] = []
): DayCoverage {
  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const codesByCode = new Map(dutyCodes.map((c) => [c.code.toUpperCase(), c]))
  const rolesById = new Map(roles.map((r) => [r.id, r]))
  const qualificationsOf = new Map(rows.map((r) => [r.user.id, r.user.qualifications]))

  const rosters = new Map<string, RosterEntry[]>() // `${roleId}|${shift}`
  for (const row of rows) {
    const hit = classifyRow(row, groupsById, codesByCode)
    if (!hit || !rolesById.has(hit.roleId)) continue
    const role = rolesById.get(hit.roleId)!
    const key = `${hit.roleId}|${hit.shift}`
    const list = rosters.get(key) ?? []
    list.push({
      userId: row.user.id,
      name: row.user.name ?? "Unnamed",
      via: hit.via,
      isBackfill: hit.isBackfill,
      unqualified: !!role.requiredQualification && !row.user.qualifications.includes(role.requiredQualification),
    })
    rosters.set(key, list)
  }

  const lines: RoleShiftCoverage[] = []
  for (const role of [...roles].sort((a, b) => a.sortOrder - b.sortOrder)) {
    for (const shift of ["DAY", "NIGHT"] as const) {
      const min = shift === "DAY" ? role.minDay : role.minNight
      const target = shift === "DAY" ? role.targetDay : role.targetNight
      if (min === 0 && target === 0) continue // this role has no requirement on this shift
      const roster = (rosters.get(`${role.id}|${shift}`) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const counted = roster.filter((r) => !r.unqualified)
      const have = counted.length

      const signOffs = evaluateSignOffs(
        requirements.filter((q) => q.coverageRoleId === role.id),
        shift,
        counted,
        qualificationsOf
      )
      // An unfillable sign-off is a hard failure, even at full headcount:
      // the shift cannot legally run without someone signed off on each job.
      const signOffShortfall = signOffs.some((s) => s.filled < s.need)
      const status = signOffShortfall ? "red" : statusFor(have, min, target)
      const standIns = signOffs.reduce((n, s) => n + s.standIns, 0)

      lines.push({ roleId: role.id, roleName: role.name, shift, have, min, target, status, roster, signOffs, signOffShortfall, standIns })
    }
  }

  const worst: CoverageStatus = lines.some((l) => l.status === "red") ? "red" : lines.some((l) => l.status === "amber") ? "amber" : "ok"
  return { date: toDateString(date), lines, status: worst }
}

/** Evaluate every day in [start, end]. */
export function evaluateCoverage(
  start: Date,
  end: Date,
  rows: CoverageScheduleRow[],
  roles: CoverageRoleDef[],
  groups: CoverageGroupDef[],
  dutyCodes: DutyCodeDef[],
  requirements: CoverageRequirementDef[] = []
): DayCoverage[] {
  const byDate = new Map<string, CoverageScheduleRow[]>()
  for (const r of rows) {
    const k = toDateString(r.date)
    const list = byDate.get(k)
    if (list) list.push(r)
    else byDate.set(k, [r])
  }
  const out: DayCoverage[] = []
  const last = normalizeToUTCMidnight(end)
  for (let d = normalizeToUTCMidnight(start); d <= last; d = addDaysUTC(d, 1)) {
    out.push(evaluateCoverageDay(d, byDate.get(toDateString(d)) ?? [], roles, groups, dutyCodes, requirements))
  }
  return out
}

/** Load roles, groups, duty codes and schedules for an organization and evaluate them. */
export async function findCoverage(organizationId: string, start: Date, end: Date) {
  const [roles, groups, codes, qualifications, requirementRows, schedules] = await Promise.all([
    prisma.coverageRole.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.positionGroup.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.customShiftType.findMany({
      where: { organizationId, isActive: true },
      select: { code: true, coverageShift: true, coverageRoleId: true, isBackfill: true },
    }),
    prisma.qualification.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.coverageRequirement.findMany({
      where: { coverageRole: { organizationId } },
      select: {
        coverageRoleId: true, countDay: true, countNight: true,
        qualification: { select: { code: true, name: true } },
        fallbacks: { orderBy: { priority: "asc" }, select: { qualification: { select: { code: true } } } },
      },
    }),
    prisma.schedule.findMany({
      where: {
        user: { organizationId, status: "ACTIVE" },
        date: { gte: normalizeToUTCMidnight(start), lte: normalizeToUTCMidnight(end) },
      },
      select: {
        date: true,
        shiftType: true,
        customShiftCode: true,
        user: {
          select: {
            id: true,
            name: true,
            positionGroupId: true,
            rosterOrder: true,
            qualifications: true,
            positionGroup: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const rows: CoverageScheduleRow[] = schedules.map((s) => ({
    date: s.date,
    shiftType: s.shiftType,
    customShiftCode: s.customShiftCode,
    user: { ...s.user, positionGroupName: s.user.positionGroup?.name ?? null },
  }))

  const requirements: CoverageRequirementDef[] = requirementRows.map((r) => ({
    coverageRoleId: r.coverageRoleId,
    code: r.qualification.code,
    name: r.qualification.name,
    countDay: r.countDay,
    countNight: r.countNight,
    fallbackCodes: r.fallbacks.map((f) => f.qualification.code),
  }))

  return {
    configured: roles.length > 0,
    roles,
    groups,
    qualifications,
    days: evaluateCoverage(start, end, rows, roles, groups, codes, requirements),
  }
}

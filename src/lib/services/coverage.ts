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

export interface RoleShiftCoverage {
  roleId: string
  roleName: string
  shift: CoverageShift
  have: number
  min: number
  target: number
  status: CoverageStatus
  roster: RosterEntry[]
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
  dutyCodes: DutyCodeDef[]
): DayCoverage {
  const groupsById = new Map(groups.map((g) => [g.id, g]))
  const codesByCode = new Map(dutyCodes.map((c) => [c.code.toUpperCase(), c]))
  const rolesById = new Map(roles.map((r) => [r.id, r]))

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
      const have = roster.filter((r) => !r.unqualified).length
      lines.push({ roleId: role.id, roleName: role.name, shift, have, min, target, status: statusFor(have, min, target), roster })
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
  dutyCodes: DutyCodeDef[]
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
    out.push(evaluateCoverageDay(d, byDate.get(toDateString(d)) ?? [], roles, groups, dutyCodes))
  }
  return out
}

/** Load roles, groups, duty codes and schedules for an organization and evaluate them. */
export async function findCoverage(organizationId: string, start: Date, end: Date) {
  const [roles, groups, codes, schedules] = await Promise.all([
    prisma.coverageRole.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.positionGroup.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.customShiftType.findMany({
      where: { organizationId, isActive: true },
      select: { code: true, coverageShift: true, coverageRoleId: true, isBackfill: true },
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

  return {
    configured: roles.length > 0,
    roles,
    groups,
    days: evaluateCoverage(start, end, rows, roles, groups, codes),
  }
}

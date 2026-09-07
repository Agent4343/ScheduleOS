import { prisma } from "../prisma"
import type { Actor } from "./schedules"

/**
 * The offshore-operations coverage template, taken from the 2026 Operations
 * Personnel Schedule workbook. Idempotent: existing roles, groups and codes
 * with the same names are updated, not duplicated.
 */

const ROLES = [
  { key: "oim", name: "OIM", sortOrder: 1, minDay: 1, targetDay: 1, minNight: 0, targetNight: 0 },
  { key: "ps", name: "Production Supervisor", sortOrder: 2, minDay: 1, targetDay: 1, minNight: 0, targetNight: 0 },
  { key: "lead", name: "Production Lead", sortOrder: 3, minDay: 1, targetDay: 1, minNight: 1, targetNight: 1 },
  { key: "ocr", name: "Control Room", sortOrder: 4, minDay: 2, targetDay: 2, minNight: 2, targetNight: 2, requiredQualification: "CCR" },
  { key: "ops", name: "Outside Ops", sortOrder: 5, minDay: 3, targetDay: 4, minNight: 3, targetNight: 4 },
] as const

const GROUPS = [
  { name: "OIM", sortOrder: 1, role: "oim", color: "#7C3AED" },
  { name: "Production Supervisor", sortOrder: 2, role: "ps", color: "#DB2777" },
  { name: "Production Leads", sortOrder: 3, role: "lead", color: "#EA580C" },
  { name: "OCR Ops", sortOrder: 4, role: "ocr", color: "#2563EB" },
  { name: "Ops Techs", sortOrder: 5, role: "ops", color: "#16A34A" },
] as const

/**
 * Sign-offs, and how many distinct holders each shift needs. The three
 * operator disciplines come out of the outside-ops crew — one each, days and
 * nights — and must be three different people.
 */
const QUALIFICATIONS = [
  { code: "UTIL", name: "Utilities Operator", color: "#0EA5E9", sortOrder: 1 },
  { code: "OIL", name: "Oil Operator", color: "#A16207", sortOrder: 2 },
  { code: "GAS", name: "Gas Operator", color: "#DC2626", sortOrder: 3 },
  { code: "CCR", name: "Control Room Trained", color: "#2563EB", sortOrder: 4 },
] as const

const REQUIREMENTS = [
  { role: "ops", code: "UTIL", countDay: 1, countNight: 1 },
  { role: "ops", code: "OIL", countDay: 1, countNight: 1 },
  { role: "ops", code: "GAS", countDay: 1, countNight: 1 },
] as const

const CODES = [
  // Control room, by OCR Ops (or anyone assigned there)
  { code: "OCR-D", name: "Control Room – Day", color: "#2563EB", shift: "DAY", role: "ocr", backfill: false },
  { code: "OCR-N", name: "Control Room – Night", color: "#1E3A8A", shift: "NIGHT", role: "ocr", backfill: false },
  // Ops Tech covering the Central Control Room (needs CCR qualification)
  { code: "CCR-D", name: "CCR – Day", color: "#0EA5E9", shift: "DAY", role: "ocr", backfill: false },
  { code: "CCR-N", name: "CCR – Night", color: "#0369A1", shift: "NIGHT", role: "ocr", backfill: false },
  // Backfill CCR: counts as an outside-ops body per the workbook's formulas
  { code: "BCCR-D", name: "Backfill CCR – Day", color: "#67E8F9", shift: "DAY", role: "ops", backfill: true },
  { code: "BCCR-N", name: "Backfill CCR – Night", color: "#22D3EE", shift: "NIGHT", role: "ops", backfill: true },
  // Backfilling leadership
  { code: "PL-D", name: "Acting Production Lead – Day", color: "#F97316", shift: "DAY", role: "lead", backfill: true },
  { code: "PL-N", name: "Acting Production Lead – Night", color: "#C2410C", shift: "NIGHT", role: "lead", backfill: true },
  { code: "PS", name: "Acting Production Supervisor", color: "#DB2777", shift: "DAY", role: "ps", backfill: true },
  { code: "OIM", name: "Acting OIM", color: "#7C3AED", shift: "DAY", role: "oim", backfill: true },
  // Non-working codes
  { code: "SL", name: "Sick Leave", color: "#EF4444", shift: null, role: null, backfill: false },
  { code: "TR", name: "Training", color: "#EAB308", shift: null, role: null, backfill: false },
  { code: "OSCC", name: "OSCC", color: "#64748B", shift: null, role: null, backfill: false },
] as const

export async function applyOffshoreOperationsTemplate(actor: Actor) {
  const organizationId = actor.organizationId

  return prisma.$transaction(async (tx) => {
    const roleIds: Record<string, string> = {}
    for (const r of ROLES) {
      const { key, ...data } = r
      const row = await tx.coverageRole.upsert({
        where: { organizationId_name: { organizationId, name: r.name } },
        update: data,
        create: { ...data, organizationId },
      })
      roleIds[key] = row.id
    }

    for (const g of GROUPS) {
      await tx.positionGroup.upsert({
        where: { organizationId_name: { organizationId, name: g.name } },
        update: { sortOrder: g.sortOrder, color: g.color, defaultCoverageRoleId: roleIds[g.role] },
        create: { name: g.name, sortOrder: g.sortOrder, color: g.color, defaultCoverageRoleId: roleIds[g.role], organizationId },
      })
    }

    const qualificationIds: Record<string, string> = {}
    for (const q of QUALIFICATIONS) {
      const row = await tx.qualification.upsert({
        where: { organizationId_code: { organizationId, code: q.code } },
        update: { name: q.name, color: q.color, sortOrder: q.sortOrder },
        create: { ...q, organizationId },
      })
      qualificationIds[q.code] = row.id
    }

    for (const r of REQUIREMENTS) {
      await tx.coverageRequirement.upsert({
        where: {
          coverageRoleId_qualificationId: {
            coverageRoleId: roleIds[r.role],
            qualificationId: qualificationIds[r.code],
          },
        },
        update: { countDay: r.countDay, countNight: r.countNight },
        create: {
          coverageRoleId: roleIds[r.role],
          qualificationId: qualificationIds[r.code],
          countDay: r.countDay,
          countNight: r.countNight,
        },
      })
    }

    for (const c of CODES) {
      const data = {
        name: c.name,
        color: c.color,
        textColor: "#ffffff",
        coverageShift: c.shift,
        coverageRoleId: c.role ? roleIds[c.role] : null,
        isBackfill: c.backfill,
        isActive: true,
      }
      await tx.customShiftType.upsert({
        where: { organizationId_code: { organizationId, code: c.code } },
        update: data,
        create: { ...data, code: c.code, organizationId },
      })
    }

    return { roles: ROLES.length, groups: GROUPS.length, codes: CODES.length, qualifications: QUALIFICATIONS.length }
  })
}

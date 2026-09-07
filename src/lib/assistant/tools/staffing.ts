import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { daysDifference, toDateString, toUTCDate } from "@/lib/timezone"
import { findStaffingGaps } from "@/lib/services/staffing"
import { ServiceError } from "@/lib/services/errors"
import { defineTool } from "../types"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

export const getStaffingRules = defineTool({
  name: "get_staffing_rules",
  description: "Show the organization's active staffing rules: minimum workers per shift, optionally per position, role or crew.",
  input: z.object({}),
  jsonSchema: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const rules = await prisma.staffingRule.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      include: { crew: { select: { name: true } } },
      orderBy: [{ shiftType: "asc" }, { priority: "desc" }],
    })
    if (rules.length === 0) {
      return "No staffing rules configured. Go to Settings to set up minimum staffing requirements."
    }
    const lines = rules.map((r) => {
      const scope = [
        r.positionType && `position ${r.positionType}`,
        r.role && `role ${r.role}`,
        r.crew && `crew ${r.crew.name}`,
      ].filter(Boolean)
      return `- ${r.name}: ${r.shiftType} shift needs at least ${r.minWorkers}${scope.length ? ` (${scope.join(", ")})` : ""}`
    })
    return ["Staffing rules:", ...lines].join("\n")
  },
})

export const checkStaffingGaps = defineTool({
  name: "check_staffing_gaps",
  description:
    "Compare scheduled workers against the staffing rules for a date range and list every shift that is below its minimum. Use this for any question about understaffing or coverage; do not work it out from who is off.",
  input: z.object({ startDate: isoDate, endDate: isoDate }),
  jsonSchema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
    },
    required: ["startDate", "endDate"],
  },
  async run(ctx, input) {
    const start = toUTCDate(input.startDate)
    const end = toUTCDate(input.endDate)
    if (end < start) throw new ServiceError("endDate must be on or after startDate")
    if (daysDifference(start, end) > 92) throw new ServiceError("Check at most three months at a time")

    const { rules, gaps } = await findStaffingGaps(ctx.organizationId, start, end)
    if (rules.length === 0) {
      return "No staffing rules configured, so gaps cannot be checked. Go to Settings to configure staffing rules."
    }
    if (gaps.length === 0) {
      return `No staffing gaps between ${input.startDate} and ${input.endDate}. Every shift meets its minimum.`
    }

    const rows = gaps.map((g) => {
      const scope = g.ruleName ?? (g.positionType ? `position ${g.positionType}` : "all workers")
      return `| ${toDateString(g.date)} | ${g.shiftType} | ${scope} | ${g.have} | ${g.need} | -${g.shortage} |`
    })
    return [
      `Staffing gaps (${input.startDate} to ${input.endDate}): ${gaps.length}`,
      ``,
      `| Date | Shift | Rule | Have | Need | Short |`,
      `|------|-------|------|------|------|-------|`,
      ...rows,
    ].join("\n")
  },
})

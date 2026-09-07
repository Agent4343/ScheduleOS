import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { addDaysUTC, startOfWeekUTC, toDateString, todayInTimeZone } from "@/lib/timezone"
import { defineTool } from "../types"

const OFF_LIKE = new Set(["OFF", "LEAVE", "VACATION", "SICK"])
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const getTodaySummary = defineTool({
  name: "get_today_summary",
  description: "Summarise today: who is on day shift, night shift, off or on leave, and how many time off requests are pending.",
  input: z.object({}),
  jsonSchema: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const today = todayInTimeZone(ctx.timeZone)

    const [schedules, pendingRequests] = await Promise.all([
      prisma.schedule.findMany({
        where: { user: { organizationId: ctx.organizationId }, date: today },
        include: { user: { select: { name: true } }, crew: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.timeOffRequest.count({ where: { user: { organizationId: ctx.organizationId }, status: "PENDING" } }),
    ])

    const day = schedules.filter((s) => s.shiftType === "DAY")
    const night = schedules.filter((s) => s.shiftType === "NIGHT")
    const off = schedules.filter((s) => OFF_LIKE.has(s.shiftType))
    const line = (s: (typeof schedules)[number]) => `   - ${s.user.name} (${s.crew?.name || "No crew"})`

    return [
      `Today's Summary (${toDateString(today)})`,
      ``,
      `Day Shift: ${day.length} workers`,
      ...day.map(line),
      ``,
      `Night Shift: ${night.length} workers`,
      ...night.map(line),
      ``,
      `Off/Leave: ${off.length} workers`,
      ...off.map((s) => `   - ${s.user.name} (${s.shiftType})`),
      ``,
      `Pending Time Off Requests: ${pendingRequests}`,
    ].join("\n")
  },
})

export const getWeekSummary = defineTool({
  name: "get_week_summary",
  description: "Per-day counts of day, night and off for a week (Sunday to Saturday).",
  input: z.object({ weekOffset: z.number().int().min(-52).max(52).optional() }),
  jsonSchema: {
    type: "object",
    properties: {
      weekOffset: { type: "number", description: "Optional: 0 = this week, 1 = next week, -1 = last week" },
    },
    required: [],
  },
  async run(ctx, input) {
    const weekStart = addDaysUTC(startOfWeekUTC(todayInTimeZone(ctx.timeZone)), (input.weekOffset ?? 0) * 7)
    const weekEnd = addDaysUTC(weekStart, 6)

    const schedules = await prisma.schedule.findMany({
      where: { user: { organizationId: ctx.organizationId }, date: { gte: weekStart, lte: weekEnd } },
      select: { date: true, shiftType: true },
    })

    const counts = new Map<string, { day: number; night: number; off: number }>()
    for (let i = 0; i < 7; i++) counts.set(toDateString(addDaysUTC(weekStart, i)), { day: 0, night: 0, off: 0 })
    for (const s of schedules) {
      const c = counts.get(toDateString(s.date))
      if (!c) continue
      if (s.shiftType === "DAY") c.day++
      else if (s.shiftType === "NIGHT") c.night++
      else c.off++
    }

    const rows = Array.from(counts.entries()).map(([date, c]) => {
      const d = new Date(date + "T00:00:00Z")
      return `${DAY_NAMES[d.getUTCDay()]} ${date} |  ${c.day}  |   ${c.night}   |  ${c.off}`
    })

    return [
      `Week Summary (${toDateString(weekStart)} to ${toDateString(weekEnd)})`,
      ``,
      `Day            | Day | Night | Off`,
      `---------------|-----|-------|----`,
      ...rows,
    ].join("\n")
  },
})

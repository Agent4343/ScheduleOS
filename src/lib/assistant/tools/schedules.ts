import { z } from "zod"
import { ShiftType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toUTCDate, toDateString } from "@/lib/timezone"
import { setShiftOverride, setShiftOverrideRange, swapShifts } from "@/lib/services/schedules"
import { defineTool } from "../types"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const assignableShift = z.enum(["DAY", "NIGHT", "OFF", "LEAVE", "VACATION", "SICK", "TRAINING", "SHUTDOWN"])

const dateProp = (description: string) => ({ type: "string", description: `${description} (YYYY-MM-DD)` })
const shiftProp = {
  type: "string",
  enum: assignableShift.options,
  description: "The type of shift to assign",
}

export const getSchedules = defineTool({
  name: "get_schedules",
  description:
    "Get schedules for workers within a date range. Use this to view who is working when and what shifts they have.",
  input: z.object({
    startDate: isoDate,
    endDate: isoDate,
    workerId: z.string().optional(),
    crewId: z.string().optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      startDate: dateProp("Start date"),
      endDate: dateProp("End date"),
      workerId: { type: "string", description: "Optional: filter by worker ID" },
      crewId: { type: "string", description: "Optional: filter by crew ID" },
    },
    required: ["startDate", "endDate"],
  },
  async run(ctx, input) {
    const schedules = await prisma.schedule.findMany({
      where: {
        user: { organizationId: ctx.organizationId, ...(input.crewId && { crewId: input.crewId }) },
        ...(input.workerId && { userId: input.workerId }),
        date: { gte: toUTCDate(input.startDate), lte: toUTCDate(input.endDate) },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        crew: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
      take: 2000,
    })

    if (schedules.length === 0) return "No schedules found for the specified date range."

    return JSON.stringify(
      schedules.map((s) => ({
        date: toDateString(s.date),
        worker: s.user.name || s.user.email,
        shift: s.shiftType === ShiftType.CUSTOM ? (s.customShiftCode ?? "CUSTOM") : s.shiftType,
        crew: s.crew?.name || "No crew",
        override: s.isOverride || undefined,
      })),
      null,
      2
    )
  },
})

export const updateSchedule = defineTool({
  name: "update_schedule",
  description:
    "Set a worker's shift on one date (change a shift, give a day off, mark vacation…). The change is kept when the rotation is regenerated.",
  input: z.object({ workerId: z.string(), date: isoDate, shiftType: assignableShift, reason: z.string().max(200).optional() }),
  jsonSchema: {
    type: "object",
    properties: {
      workerId: { type: "string", description: "The worker's ID" },
      date: dateProp("The date"),
      shiftType: shiftProp,
      reason: { type: "string", description: "Optional: why the change is being made" },
    },
    required: ["workerId", "date", "shiftType"],
  },
  async run(ctx, input) {
    const schedule = await setShiftOverride(ctx, {
      userId: input.workerId,
      date: toUTCDate(input.date),
      shiftType: input.shiftType,
      reason: input.reason ?? "Changed by AI assistant",
    })
    return `Set ${schedule.user.name}'s shift on ${input.date} to ${input.shiftType}.`
  },
})

export const bulkUpdateSchedules = defineTool({
  name: "bulk_update_schedules",
  description:
    "Set the same shift for a worker on every day in a date range. Useful for vacation periods or changing a whole week.",
  input: z.object({
    workerId: z.string(),
    startDate: isoDate,
    endDate: isoDate,
    shiftType: assignableShift,
    reason: z.string().max(200).optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      workerId: { type: "string", description: "The worker's ID" },
      startDate: dateProp("Start date"),
      endDate: dateProp("End date"),
      shiftType: shiftProp,
      reason: { type: "string", description: "Optional: why the change is being made" },
    },
    required: ["workerId", "startDate", "endDate", "shiftType"],
  },
  async run(ctx, input) {
    const { worker, days } = await setShiftOverrideRange(ctx, {
      userId: input.workerId,
      startDate: toUTCDate(input.startDate),
      endDate: toUTCDate(input.endDate),
      shiftType: input.shiftType,
      reason: input.reason ?? "Changed by AI assistant",
    })
    return `Set ${days} day(s) for ${worker.name} to ${input.shiftType} (${input.startDate} to ${input.endDate}).`
  },
})

export const swapShiftsTool = defineTool({
  name: "swap_shifts",
  description: "Swap the shifts of two workers on the given dates. Both workers must already have a schedule entry on their date.",
  input: z.object({ worker1Id: z.string(), worker1Date: isoDate, worker2Id: z.string(), worker2Date: isoDate }),
  jsonSchema: {
    type: "object",
    properties: {
      worker1Id: { type: "string", description: "First worker's ID" },
      worker1Date: dateProp("Date of the first worker's shift"),
      worker2Id: { type: "string", description: "Second worker's ID" },
      worker2Date: dateProp("Date of the second worker's shift"),
    },
    required: ["worker1Id", "worker1Date", "worker2Id", "worker2Date"],
  },
  async run(ctx, input) {
    const { worker1, worker2 } = await swapShifts(ctx, {
      worker1Id: input.worker1Id,
      date1: toUTCDate(input.worker1Date),
      worker2Id: input.worker2Id,
      date2: toUTCDate(input.worker2Date),
    })
    return `Swapped: ${worker1.name} now has ${worker1.nowHas} on ${input.worker1Date}; ${worker2.name} now has ${worker2.nowHas} on ${input.worker2Date}.`
  },
})

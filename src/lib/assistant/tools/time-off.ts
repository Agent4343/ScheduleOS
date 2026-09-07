import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { toDateString } from "@/lib/timezone"
import { reviewTimeOffRequest } from "@/lib/services/time-off"
import { defineTool } from "../types"

export const getTimeOffRequests = defineTool({
  name: "get_time_off_requests",
  description: "List time off requests, optionally filtered by status or worker. Newest first, up to 20.",
  input: z.object({
    status: z.enum(["PENDING", "APPROVED", "DENIED", "CANCELLED"]).optional(),
    workerId: z.string().optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["PENDING", "APPROVED", "DENIED", "CANCELLED"], description: "Optional: filter by status" },
      workerId: { type: "string", description: "Optional: filter by worker ID" },
    },
    required: [],
  },
  async run(ctx, input) {
    const requests = await prisma.timeOffRequest.findMany({
      where: {
        user: { organizationId: ctx.organizationId },
        ...(input.status && { status: input.status }),
        ...(input.workerId && { userId: input.workerId }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    if (requests.length === 0) return "No time off requests found."
    return JSON.stringify(
      requests.map((r) => ({
        id: r.id,
        worker: r.user.name || r.user.email,
        workerId: r.user.id,
        startDate: toDateString(r.startDate),
        endDate: toDateString(r.endDate),
        type: r.type,
        status: r.status,
        reason: r.reason || "No reason provided",
      })),
      null,
      2
    )
  },
})

export const updateTimeOffRequest = defineTool({
  name: "update_time_off_request",
  description: "Approve or deny a pending time off request. Approving puts the leave on the worker's schedule.",
  input: z.object({
    requestId: z.string(),
    status: z.enum(["APPROVED", "DENIED"]),
    reason: z.string().max(1000).optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      requestId: { type: "string", description: "The time off request ID" },
      status: { type: "string", enum: ["APPROVED", "DENIED"], description: "The decision" },
      reason: { type: "string", description: "Optional: note to the worker explaining the decision" },
    },
    required: ["requestId", "status"],
  },
  async run(ctx, input) {
    const { worker } = await reviewTimeOffRequest(ctx, {
      requestId: input.requestId,
      status: input.status,
      adminNotes: input.reason,
    })
    return `Time off request for ${worker.name ?? worker.email} has been ${input.status.toLowerCase()}.${
      input.status === "APPROVED" ? " The schedule has been updated and the worker notified." : " The worker has been notified."
    }`
  },
})

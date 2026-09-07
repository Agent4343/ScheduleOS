import { z } from "zod"
import { UserStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { updateWorker } from "@/lib/services/workers"
import { defineTool } from "../types"

const statusEnum = z.nativeEnum(UserStatus)

export const getWorkers = defineTool({
  name: "get_workers",
  description: "List workers. Can filter by crew, status, or search by name.",
  input: z.object({ search: z.string().optional(), crewId: z.string().optional(), status: statusEnum.optional() }),
  jsonSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional: search workers by name" },
      crewId: { type: "string", description: "Optional: filter by crew ID" },
      status: { type: "string", enum: Object.values(UserStatus), description: "Optional: filter by status" },
    },
    required: [],
  },
  async run(ctx, input) {
    const workers = await prisma.user.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(input.search && { name: { contains: input.search, mode: "insensitive" } }),
        ...(input.crewId && { crewId: input.crewId }),
        ...(input.status && { status: input.status }),
      },
      select: {
        id: true, name: true, email: true, position: true, status: true, role: true,
        crew: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: 500,
    })
    if (workers.length === 0) return "No workers found matching the criteria."
    return JSON.stringify(
      workers.map((w) => ({
        id: w.id,
        name: w.name || "Unnamed",
        email: w.email,
        position: w.position || "Not set",
        crew: w.crew?.name || "No crew",
        status: w.status,
        role: w.role,
      })),
      null,
      2
    )
  },
})

export const getWorkerByName = defineTool({
  name: "get_worker_by_name",
  description: "Find a worker by name (partial match). Returns their ID, crew, role and status.",
  input: z.object({ name: z.string().min(1) }),
  jsonSchema: {
    type: "object",
    properties: { name: { type: "string", description: "The worker's name (partial match supported)" } },
    required: ["name"],
  },
  async run(ctx, input) {
    const workers = await prisma.user.findMany({
      where: { organizationId: ctx.organizationId, name: { contains: input.name, mode: "insensitive" } },
      select: {
        id: true, name: true, email: true, position: true, phone: true, status: true, role: true,
        crew: { select: { id: true, name: true } },
      },
      take: 20,
    })
    if (workers.length === 0) return `No worker found with name matching "${input.name}".`
    return JSON.stringify(
      workers.map((w) => ({
        id: w.id,
        name: w.name,
        email: w.email,
        position: w.position,
        phone: w.phone,
        crew: w.crew?.name || "No crew",
        crewId: w.crew?.id,
        status: w.status,
        role: w.role,
      })),
      null,
      2
    )
  },
})

export const updateWorkerTool = defineTool({
  name: "update_worker",
  description:
    "Update a worker's name, position, phone, crew assignment or status. Role changes are not available here. Only admins can change status.",
  input: z.object({
    workerId: z.string(),
    name: z.string().min(2).max(100).optional(),
    position: z.string().max(100).optional(),
    phone: z.string().max(40).optional(),
    crewId: z.string().optional(),
    status: statusEnum.optional(),
  }),
  jsonSchema: {
    type: "object",
    properties: {
      workerId: { type: "string", description: "The worker's ID" },
      name: { type: "string", description: "Optional: new name" },
      position: { type: "string", description: "Optional: new position / job title" },
      phone: { type: "string", description: "Optional: new phone number" },
      crewId: { type: "string", description: "Optional: crew ID to assign" },
      status: { type: "string", enum: Object.values(UserStatus), description: "Optional: new status (admins only)" },
    },
    required: ["workerId"],
  },
  async run(ctx, input) {
    const { workerId, ...changes } = input
    const worker = await updateWorker({ ...ctx, role: ctx.userRole }, workerId, changes)
    return `Updated ${worker.name}'s information.`
  },
})

export const getCrews = defineTool({
  name: "get_crews",
  description: "List all crews in the organization with their rotation pattern and member count.",
  input: z.object({}),
  jsonSchema: { type: "object", properties: {}, required: [] },
  async run(ctx) {
    const crews = await prisma.crew.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true, name: true, color: true,
        rotationPattern: { select: { name: true, daysOn: true, daysOff: true } },
        _count: { select: { workers: true } },
      },
      orderBy: { name: "asc" },
    })
    return JSON.stringify(
      crews.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        rotation: c.rotationPattern ? `${c.rotationPattern.name} (${c.rotationPattern.daysOn}/${c.rotationPattern.daysOff})` : "None",
        memberCount: c._count.workers,
      })),
      null,
      2
    )
  },
})

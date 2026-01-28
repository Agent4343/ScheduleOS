import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { ShiftType, UserStatus, RequestStatus } from "@/types"

// Tool definitions for the AI assistant
const tools: Anthropic.Tool[] = [
  {
    name: "get_schedules",
    description: "Get schedules for workers within a date range. Use this to view who is working when and what shifts they have.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        workerId: {
          type: "string",
          description: "Optional: Filter by specific worker ID",
        },
        crewId: {
          type: "string",
          description: "Optional: Filter by specific crew ID",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "update_schedule",
    description: "Update or create a schedule entry for a worker on a specific date. Use this to change shifts, assign days off, vacations, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        workerId: {
          type: "string",
          description: "The worker's ID",
        },
        date: {
          type: "string",
          description: "The date in YYYY-MM-DD format",
        },
        shiftType: {
          type: "string",
          enum: ["DAY", "NIGHT", "OFF", "LEAVE", "VACATION", "SICK", "TRAINING", "SHUTDOWN"],
          description: "The type of shift to assign",
        },
      },
      required: ["workerId", "date", "shiftType"],
    },
  },
  {
    name: "get_workers",
    description: "Get a list of workers/employees. Can filter by crew, status, or search by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Optional: Search workers by name",
        },
        crewId: {
          type: "string",
          description: "Optional: Filter by crew ID",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"],
          description: "Optional: Filter by status",
        },
      },
      required: [],
    },
  },
  {
    name: "get_worker_by_name",
    description: "Find a worker by their name. Returns the worker's details including their ID, crew, role, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The worker's name (partial match supported)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_worker",
    description: "Update a worker's information like name, position, phone, crew assignment, or status.",
    input_schema: {
      type: "object" as const,
      properties: {
        workerId: {
          type: "string",
          description: "The worker's ID",
        },
        name: {
          type: "string",
          description: "Optional: New name",
        },
        position: {
          type: "string",
          description: "Optional: New position/job title",
        },
        phone: {
          type: "string",
          description: "Optional: New phone number",
        },
        crewId: {
          type: "string",
          description: "Optional: New crew ID to assign",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"],
          description: "Optional: New status",
        },
      },
      required: ["workerId"],
    },
  },
  {
    name: "get_crews",
    description: "Get a list of all crews in the organization.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_time_off_requests",
    description: "Get time off requests. Can filter by status or worker.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["PENDING", "APPROVED", "DENIED"],
          description: "Optional: Filter by request status",
        },
        workerId: {
          type: "string",
          description: "Optional: Filter by worker ID",
        },
      },
      required: [],
    },
  },
  {
    name: "update_time_off_request",
    description: "Approve or deny a time off request.",
    input_schema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "The time off request ID",
        },
        status: {
          type: "string",
          enum: ["APPROVED", "DENIED"],
          description: "The new status",
        },
        reason: {
          type: "string",
          description: "Optional: Reason for approval/denial",
        },
      },
      required: ["requestId", "status"],
    },
  },
  {
    name: "get_today_summary",
    description: "Get a summary of today's schedule including who is working, any time off, and staffing levels.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_week_summary",
    description: "Get a summary of this week's schedule and any upcoming time off requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        weekOffset: {
          type: "number",
          description: "Optional: Week offset (0 = current week, 1 = next week, -1 = last week)",
        },
      },
      required: [],
    },
  },
  {
    name: "swap_shifts",
    description: "Swap shifts between two workers on specific dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        worker1Id: {
          type: "string",
          description: "First worker's ID",
        },
        worker1Date: {
          type: "string",
          description: "Date of first worker's shift (YYYY-MM-DD)",
        },
        worker2Id: {
          type: "string",
          description: "Second worker's ID",
        },
        worker2Date: {
          type: "string",
          description: "Date of second worker's shift (YYYY-MM-DD)",
        },
      },
      required: ["worker1Id", "worker1Date", "worker2Id", "worker2Date"],
    },
  },
  {
    name: "bulk_update_schedules",
    description: "Update schedules for multiple days at once. Useful for setting vacation periods or changing a week of shifts.",
    input_schema: {
      type: "object" as const,
      properties: {
        workerId: {
          type: "string",
          description: "The worker's ID",
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD)",
        },
        shiftType: {
          type: "string",
          enum: ["DAY", "NIGHT", "OFF", "LEAVE", "VACATION", "SICK", "TRAINING", "SHUTDOWN"],
          description: "The shift type to apply to all days",
        },
      },
      required: ["workerId", "startDate", "endDate", "shiftType"],
    },
  },
]

interface ToolInput {
  startDate?: string
  endDate?: string
  workerId?: string
  crewId?: string
  date?: string
  shiftType?: ShiftType
  search?: string
  status?: string
  name?: string
  position?: string
  phone?: string
  requestId?: string
  reason?: string
  weekOffset?: number
  worker1Id?: string
  worker1Date?: string
  worker2Id?: string
  worker2Date?: string
}

// Tool execution functions
async function executeTool(
  name: string,
  input: ToolInput,
  organizationId: string
): Promise<string> {
  try {
    switch (name) {
      case "get_schedules": {
        const whereClause: {
          user: { organizationId: string; crewId?: string }
          date: { gte: Date; lte: Date }
          userId?: string
        } = {
          user: { organizationId },
          date: {
            gte: new Date(input.startDate!),
            lte: new Date(input.endDate!),
          },
        }
        if (input.workerId) {
          whereClause.userId = input.workerId
        }
        if (input.crewId) {
          whereClause.user.crewId = input.crewId
        }

        const schedules = await prisma.schedule.findMany({
          where: whereClause,
          include: {
            user: { select: { id: true, name: true, email: true } },
            crew: { select: { id: true, name: true } },
          },
          orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
        })

        if (schedules.length === 0) {
          return "No schedules found for the specified date range."
        }

        const formatted = schedules.map((s: { date: Date; user: { name: string | null; email: string }; shiftType: string; crew: { name: string } | null }) => ({
          date: s.date.toISOString().split("T")[0],
          worker: s.user.name || s.user.email,
          shift: s.shiftType,
          crew: s.crew?.name || "No crew",
        }))

        return JSON.stringify(formatted, null, 2)
      }

      case "update_schedule": {
        const existingSchedule = await prisma.schedule.findFirst({
          where: {
            userId: input.workerId!,
            date: new Date(input.date!),
          },
        })

        const worker = await prisma.user.findFirst({
          where: { id: input.workerId!, organizationId },
          include: { crew: true },
        })

        if (!worker) {
          return "Worker not found."
        }

        if (existingSchedule) {
          await prisma.schedule.update({
            where: { id: existingSchedule.id },
            data: { shiftType: input.shiftType! },
          })
          return `Updated ${worker.name}'s schedule on ${input.date} to ${input.shiftType}.`
        } else {
          await prisma.schedule.create({
            data: {
              userId: input.workerId!,
              date: new Date(input.date!),
              shiftType: input.shiftType!,
              crewId: worker.crewId,
            },
          })
          return `Created ${input.shiftType} shift for ${worker.name} on ${input.date}.`
        }
      }

      case "get_workers": {
        const whereClause: {
          organizationId: string
          name?: { contains: string; mode: "insensitive" }
          crewId?: string
          status?: UserStatus
        } = { organizationId }

        if (input.search) {
          whereClause.name = { contains: input.search, mode: "insensitive" }
        }
        if (input.crewId) {
          whereClause.crewId = input.crewId
        }
        if (input.status) {
          whereClause.status = input.status as UserStatus
        }

        const workers = await prisma.user.findMany({
          where: whereClause,
          include: {
            crew: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        })

        if (workers.length === 0) {
          return "No workers found matching the criteria."
        }

        const formatted = workers.map((w: { id: string; name: string | null; email: string; position: string | null; crew: { name: string } | null; status: string; role: string }) => ({
          id: w.id,
          name: w.name || "Unnamed",
          email: w.email,
          position: w.position || "Not set",
          crew: w.crew?.name || "No crew",
          status: w.status,
          role: w.role,
        }))

        return JSON.stringify(formatted, null, 2)
      }

      case "get_worker_by_name": {
        const workers = await prisma.user.findMany({
          where: {
            organizationId,
            name: { contains: input.name!, mode: "insensitive" },
          },
          include: {
            crew: { select: { id: true, name: true } },
          },
        })

        if (workers.length === 0) {
          return `No worker found with name matching "${input.name}".`
        }

        const formatted = workers.map((w: { id: string; name: string | null; email: string; position: string | null; phone: string | null; crew: { name: string } | null; status: string; role: string }) => ({
          id: w.id,
          name: w.name,
          email: w.email,
          position: w.position,
          phone: w.phone,
          crew: w.crew?.name || "No crew",
          status: w.status,
          role: w.role,
        }))

        return JSON.stringify(formatted, null, 2)
      }

      case "update_worker": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {}
        if (input.name) updateData.name = input.name
        if (input.position) updateData.position = input.position
        if (input.phone) updateData.phone = input.phone
        if (input.crewId) updateData.crew = { connect: { id: input.crewId } }
        if (input.status) updateData.status = input.status as UserStatus

        const worker = await prisma.user.update({
          where: { id: input.workerId! },
          data: updateData,
          include: { crew: true },
        })

        return `Updated ${worker.name}'s information successfully.`
      }

      case "get_crews": {
        const crews = await prisma.crew.findMany({
          where: { organizationId },
          include: {
            _count: { select: { workers: true } },
          },
          orderBy: { name: "asc" },
        })

        const formatted = crews.map((c: { id: string; name: string; color: string; _count: { workers: number } }) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          memberCount: c._count.workers,
        }))

        return JSON.stringify(formatted, null, 2)
      }

      case "get_time_off_requests": {
        const whereClause: {
          user: { organizationId: string }
          status?: RequestStatus
          userId?: string
        } = { user: { organizationId } }

        if (input.status) {
          whereClause.status = input.status as RequestStatus
        }
        if (input.workerId) {
          whereClause.userId = input.workerId
        }

        const requests = await prisma.timeOffRequest.findMany({
          where: whereClause,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })

        if (requests.length === 0) {
          return "No time off requests found."
        }

        const formatted = requests.map((r: { id: string; user: { name: string | null; email: string }; startDate: Date; endDate: Date; type: string; status: string; reason: string | null }) => ({
          id: r.id,
          worker: r.user.name || r.user.email,
          startDate: r.startDate.toISOString().split("T")[0],
          endDate: r.endDate.toISOString().split("T")[0],
          type: r.type,
          status: r.status,
          reason: r.reason || "No reason provided",
        }))

        return JSON.stringify(formatted, null, 2)
      }

      case "update_time_off_request": {
        const updateData: { status: RequestStatus; reviewNotes?: string; reviewedAt: Date } = {
          status: input.status as RequestStatus,
          reviewedAt: new Date(),
        }
        if (input.reason) {
          updateData.reviewNotes = input.reason
        }

        const request = await prisma.timeOffRequest.update({
          where: { id: input.requestId! },
          data: updateData,
          include: { user: true },
        })

        // If approved, update the schedules
        if (input.status === "APPROVED") {
          const startDate = new Date(request.startDate)
          const endDate = new Date(request.endDate)
          const currentDate = new Date(startDate)

          while (currentDate <= endDate) {
            await prisma.schedule.upsert({
              where: {
                userId_date: {
                  userId: request.userId,
                  date: new Date(currentDate),
                },
              },
              update: {
                shiftType: request.type === "VACATION" ? "VACATION" : "LEAVE",
              },
              create: {
                userId: request.userId,
                date: new Date(currentDate),
                shiftType: request.type === "VACATION" ? "VACATION" : "LEAVE",
              },
            })
            currentDate.setDate(currentDate.getDate() + 1)
          }
        }

        return `Time off request for ${request.user.name} has been ${input.status!.toLowerCase()}.${input.status === "APPROVED" ? " Schedule has been updated." : ""}`
      }

      case "get_today_summary": {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const schedules = await prisma.schedule.findMany({
          where: {
            user: { organizationId },
            date: today,
          },
          include: {
            user: { select: { name: true } },
            crew: { select: { name: true } },
          },
        })

        const pendingRequests = await prisma.timeOffRequest.count({
          where: {
            user: { organizationId },
            status: "PENDING",
          },
        })

        const dayShifts = schedules.filter((s: { shiftType: string }) => s.shiftType === "DAY")
        const nightShifts = schedules.filter((s: { shiftType: string }) => s.shiftType === "NIGHT")
        const offToday = schedules.filter((s: { shiftType: string }) =>
          ["OFF", "LEAVE", "VACATION", "SICK"].includes(s.shiftType)
        )

        let summary = `📅 Today's Summary (${today.toLocaleDateString()})\n\n`
        summary += `🌞 Day Shift: ${dayShifts.length} workers\n`
        dayShifts.forEach((s: { user: { name: string | null }; crew: { name: string } | null }) => {
          summary += `   - ${s.user.name} (${s.crew?.name || "No crew"})\n`
        })
        summary += `\n🌙 Night Shift: ${nightShifts.length} workers\n`
        nightShifts.forEach((s: { user: { name: string | null }; crew: { name: string } | null }) => {
          summary += `   - ${s.user.name} (${s.crew?.name || "No crew"})\n`
        })
        summary += `\n🏠 Off/Leave: ${offToday.length} workers\n`
        offToday.forEach((s: { user: { name: string | null }; shiftType: string }) => {
          summary += `   - ${s.user.name} (${s.shiftType})\n`
        })
        summary += `\n📋 Pending Time Off Requests: ${pendingRequests}`

        return summary
      }

      case "get_week_summary": {
        const offset = input.weekOffset || 0
        const today = new Date()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay() + offset * 7)
        startOfWeek.setHours(0, 0, 0, 0)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)

        const schedules = await prisma.schedule.findMany({
          where: {
            user: { organizationId },
            date: { gte: startOfWeek, lte: endOfWeek },
          },
          include: {
            user: { select: { name: true } },
          },
          orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
        })

        const byDay: Record<string, { day: number; night: number; off: number }> = {}
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek)
          d.setDate(startOfWeek.getDate() + i)
          byDay[d.toISOString().split("T")[0]] = { day: 0, night: 0, off: 0 }
        }

        schedules.forEach((s: { date: Date; shiftType: string }) => {
          const dateKey = s.date.toISOString().split("T")[0]
          if (byDay[dateKey]) {
            if (s.shiftType === "DAY") byDay[dateKey].day++
            else if (s.shiftType === "NIGHT") byDay[dateKey].night++
            else byDay[dateKey].off++
          }
        })

        let summary = `📅 Week Summary (${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()})\n\n`
        summary += "Day       | Day | Night | Off\n"
        summary += "----------|-----|-------|----\n"

        Object.entries(byDay).forEach(([date, counts]) => {
          const d = new Date(date)
          summary += `${days[d.getDay()]} ${d.getDate().toString().padStart(2)}    |  ${counts.day}  |   ${counts.night}   |  ${counts.off}\n`
        })

        return summary
      }

      case "swap_shifts": {
        const schedule1 = await prisma.schedule.findFirst({
          where: {
            userId: input.worker1Id!,
            date: new Date(input.worker1Date!),
          },
          include: { user: true },
        })

        const schedule2 = await prisma.schedule.findFirst({
          where: {
            userId: input.worker2Id!,
            date: new Date(input.worker2Date!),
          },
          include: { user: true },
        })

        if (!schedule1 || !schedule2) {
          return "One or both schedules not found. Make sure both workers have schedules for the specified dates."
        }

        await prisma.$transaction([
          prisma.schedule.update({
            where: { id: schedule1.id },
            data: { shiftType: schedule2.shiftType },
          }),
          prisma.schedule.update({
            where: { id: schedule2.id },
            data: { shiftType: schedule1.shiftType },
          }),
        ])

        return `Swapped shifts: ${schedule1.user.name} now has ${schedule2.shiftType} on ${input.worker1Date}, and ${schedule2.user.name} now has ${schedule1.shiftType} on ${input.worker2Date}.`
      }

      case "bulk_update_schedules": {
        const worker = await prisma.user.findFirst({
          where: { id: input.workerId!, organizationId },
        })

        if (!worker) {
          return "Worker not found."
        }

        const startDate = new Date(input.startDate!)
        const endDate = new Date(input.endDate!)
        const currentDate = new Date(startDate)
        let count = 0

        while (currentDate <= endDate) {
          await prisma.schedule.upsert({
            where: {
              userId_date: {
                userId: input.workerId!,
                date: new Date(currentDate),
              },
            },
            update: { shiftType: input.shiftType! },
            create: {
              userId: input.workerId!,
              date: new Date(currentDate),
              shiftType: input.shiftType!,
              crewId: worker.crewId,
            },
          })
          currentDate.setDate(currentDate.getDate() + 1)
          count++
        }

        return `Updated ${count} days of schedules for ${worker.name} to ${input.shiftType} (${input.startDate} to ${input.endDate}).`
      }

      default:
        return `Unknown tool: ${name}`
    }
  } catch (error) {
    console.error(`Tool execution error (${name}):`, error)
    return `Error executing ${name}: ${error instanceof Error ? error.message : "Unknown error"}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission (at least SUPERVISOR)
    if (session.user.role === "WORKER") {
      return NextResponse.json(
        { error: "Only supervisors and admins can use the AI assistant" },
        { status: 403 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI assistant is not configured. Please add ANTHROPIC_API_KEY to your environment variables." },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { messages, sessionId, userMessage } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 })
    }

    // Handle session persistence
    let activeSessionId = sessionId
    if (sessionId && userMessage) {
      // Save user message to existing session
      await prisma.aIChatMessage.create({
        data: {
          sessionId,
          role: "user",
          content: userMessage,
        },
      })
      // Update session timestamp
      await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      })
    } else if (userMessage && !sessionId) {
      // Create new session with user message
      const newSession = await prisma.aIChatSession.create({
        data: {
          title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""),
          userId: session.user.id,
          organizationId: session.user.organizationId,
          messages: {
            create: {
              role: "user",
              content: userMessage,
            },
          },
        },
      })
      activeSessionId = newSession.id
    }

    // Limit messages to prevent token overflow (keep last 10 messages)
    const limitedMessages = messages.slice(-10).map((m: { role: string; content: string }) => ({
      ...m,
      // Truncate very long messages to prevent token overflow
      content: m.content.length > 4000 ? m.content.slice(0, 4000) + "..." : m.content,
    }))

    const client = new Anthropic({ apiKey })

    // Get organization context
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    })

    const systemPrompt = `You are an AI assistant for ShiftSync, a workforce scheduling application. You help manage schedules, workers, time off requests, and more for ${org?.name || "this organization"}.

Current date and time: ${new Date().toLocaleString()}
User: ${session.user.name || session.user.email} (${session.user.role})

You have access to tools to:
- View and modify schedules
- Look up worker information
- Manage time off requests
- Get summaries of schedules

Guidelines:
1. Always confirm before making changes that affect multiple people or dates
2. When showing schedules, format them clearly
3. If a user mentions a worker by name, use get_worker_by_name to find their ID first
4. Be concise but helpful
5. If you're unsure about a request, ask for clarification
6. For date ranges, always use YYYY-MM-DD format internally

Important: When the user asks to change a schedule, you must:
1. First find the worker using get_worker_by_name if only a name is provided
2. Then use update_schedule or bulk_update_schedules to make the change`

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = limitedMessages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    )

    // Initial API call
    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    })

    const toolCalls: { name: string; status: string; result?: string }[] = []

    // Handle tool use loop
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          toolUse.name,
          toolUse.input as ToolInput,
          session.user.organizationId
        )

        toolCalls.push({
          name: toolUse.name,
          status: result.startsWith("Error") ? "error" : "success",
          result,
        })

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        })
      }

      // Continue conversation with tool results
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: [
          ...claudeMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ],
      })
    }

    // Extract final text response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    )

    const assistantContent = textContent?.text || "I apologize, but I couldn't generate a response."

    // Save assistant response to session
    if (activeSessionId) {
      await prisma.aIChatMessage.create({
        data: {
          sessionId: activeSessionId,
          role: "assistant",
          content: assistantContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      })
    }

    return NextResponse.json({
      content: assistantContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      sessionId: activeSessionId,
    })
  } catch (error) {
    console.error("Assistant API error:", error)

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${error.message}` },
        { status: error.status || 500 }
      )
    }

    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    )
  }
}

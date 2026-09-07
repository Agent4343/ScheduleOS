import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiError, handleRouteError, parseBody } from "@/lib/api-helpers"
import { rateLimit, rateLimitPresets } from "@/lib/rate-limit"
import { getOrganizationTimeZone } from "@/lib/org-timezone"
import { toDateString, todayInTimeZone } from "@/lib/timezone"
import { runAgent, type AgentTurn } from "@/lib/assistant/agent"
import { buildSystemPrompt } from "@/lib/assistant/prompt"

/**
 * POST /api/assistant — one turn of the scheduling assistant.
 *
 * The conversation history comes from the stored session, never from the
 * client, so a caller cannot forge earlier assistant turns. The user's
 * message and the assistant's reply are saved together after the model
 * answers, so a failed call leaves no half-written transcript.
 */

const bodySchema = z.object({
  userMessage: z.string().trim().min(1, "Message is required").max(4000),
  sessionId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return apiError("AI assistant is not configured. Add ANTHROPIC_API_KEY to the environment.", 503)
    }

    const limit = await rateLimit(`assistant:${session.user.id}`, rateLimitPresets.expensive)
    if (!limit.success) {
      return apiError("Too many assistant requests. Please wait a minute and try again.", 429)
    }

    const { userMessage, sessionId } = await parseBody(bodySchema, request)

    // Load history from the stored session (or start a new one)
    let history: AgentTurn[] = []
    if (sessionId) {
      const existing = await prisma.aIChatSession.findFirst({
        where: { id: sessionId, userId: session.user.id, organizationId: session.user.organizationId },
        include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
      })
      if (!existing) return apiError("Session not found or access denied", 403)
      history = existing.messages
        .filter((m): m is { role: "user" | "assistant"; content: string } => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }))
    }
    history.push({ role: "user", content: userMessage })

    const [organization, timeZone] = await Promise.all([
      prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { name: true } }),
      getOrganizationTimeZone(session.user.organizationId),
    ])

    const result = await runAgent({
      apiKey,
      systemPrompt: buildSystemPrompt({
        organizationName: organization?.name ?? "this organization",
        userLabel: session.user.name || session.user.email,
        userRole: session.user.role,
        today: toDateString(todayInTimeZone(timeZone)),
        timeZone,
      }),
      history,
      ctx: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        userRole: session.user.role,
        timeZone,
      },
    })

    // Persist both turns together
    const toolCalls =
      result.toolCalls.length > 0 ? (result.toolCalls as unknown as Prisma.InputJsonArray) : undefined
    const activeSessionId = sessionId
      ? (await prisma.aIChatSession.update({
          where: { id: sessionId },
          data: {
            updatedAt: new Date(),
            messages: {
              create: [
                { role: "user", content: userMessage },
                { role: "assistant", content: result.text, toolCalls },
              ],
            },
          },
          select: { id: true },
        })).id
      : (await prisma.aIChatSession.create({
          data: {
            title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "…" : ""),
            userId: session.user.id,
            organizationId: session.user.organizationId,
            messages: {
              create: [
                { role: "user", content: userMessage },
                { role: "assistant", content: result.text, toolCalls },
              ],
            },
          },
          select: { id: true },
        })).id

    return NextResponse.json({ content: result.text, toolCalls, sessionId: activeSessionId })
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("Assistant API error:", error.status, error.message)
      return apiError("The AI service returned an error. Please try again.", error.status === 429 ? 429 : 502)
    }
    return handleRouteError(error, "Failed to process your request. Please try again.")
  }
}

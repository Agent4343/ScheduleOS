import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

// GET /api/assistant/sessions/[sessionId] - Get a specific chat session with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { sessionId } = await params

    const chatSession = await prisma.aIChatSession.findFirst({
      where: {
        id: sessionId,
        userId: auth.session.user.id,
        organizationId: auth.session.user.organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json(chatSession)
  } catch (error) {
    console.error("Error fetching chat session:", error)
    return NextResponse.json(
      { error: "Failed to fetch chat session" },
      { status: 500 }
    )
  }
}

// DELETE /api/assistant/sessions/[sessionId] - Delete a chat session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { sessionId } = await params

    const chatSession = await prisma.aIChatSession.findFirst({
      where: {
        id: sessionId,
        userId: auth.session.user.id,
        organizationId: auth.session.user.organizationId,
      },
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    await prisma.aIChatSession.delete({
      where: { id: sessionId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting chat session:", error)
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    )
  }
}

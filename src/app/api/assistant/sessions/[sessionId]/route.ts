import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/assistant/sessions/[sessionId] - Get a specific chat session with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    const chatSession = await prisma.aIChatSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId } = await params

    // Verify ownership
    const chatSession = await prisma.aIChatSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
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

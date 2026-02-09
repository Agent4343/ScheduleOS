import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/assistant/sessions - Get all chat sessions for the user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessions = await prisma.aIChatSession.findMany({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      orderBy: { updatedAt: "desc" },
      take: 20, // Limit to last 20 sessions
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error("Error fetching chat sessions:", error)
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    )
  }
}

// POST /api/assistant/sessions - Create a new chat session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title } = body

    const chatSession = await prisma.aIChatSession.create({
      data: {
        title: title || "New conversation",
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json(chatSession)
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    )
  }
}

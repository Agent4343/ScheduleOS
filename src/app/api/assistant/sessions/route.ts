import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

// GET /api/assistant/sessions - Get all chat sessions for the user
export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const sessions = await prisma.aIChatSession.findMany({
      where: {
        userId: auth.session.user.id,
        organizationId: auth.session.user.organizationId,
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
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
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { title } = body

    const chatSession = await prisma.aIChatSession.create({
      data: {
        title: title || "New conversation",
        userId: auth.session.user.id,
        organizationId: auth.session.user.organizationId,
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

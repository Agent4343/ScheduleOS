import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    const announcements = await prisma.announcement.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: limit,
    })

    return NextResponse.json({ success: true, data: announcements })
  } catch (error) {
    console.error("Error fetching announcements:", error)
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const { title, content, priority, pinned, expiresAt } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
    }

    // Sanitize inputs — strip HTML tags to prevent stored XSS
    const sanitize = (str: string) => str.replace(/<[^>]*>/g, "").trim()
    const cleanTitle = sanitize(title).slice(0, 200)
    const cleanContent = sanitize(content).slice(0, 5000)

    if (!cleanTitle || !cleanContent) {
      return NextResponse.json({ error: "Title and content must contain text" }, { status: 400 })
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: cleanTitle,
        content: cleanContent,
        priority: priority || "NORMAL",
        pinned: pinned || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        authorId: session.user.id,
        organizationId: session.user.organizationId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json({ success: true, data: announcement }, { status: 201 })
  } catch (error) {
    console.error("Error creating announcement:", error)
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
  }
}

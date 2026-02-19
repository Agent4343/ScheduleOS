import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const existing = await prisma.announcement.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const body = await request.json()
    const { title, content, priority, pinned, expiresAt } = body

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(priority !== undefined && { priority }),
        ...(pinned !== undefined && { pinned }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
      include: {
        author: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error updating announcement:", error)
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const existing = await prisma.announcement.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })

    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    await prisma.announcement.delete({ where: { id } })

    return NextResponse.json({ success: true, message: "Announcement deleted" })
  } catch (error) {
    console.error("Error deleting announcement:", error)
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 })
  }
}

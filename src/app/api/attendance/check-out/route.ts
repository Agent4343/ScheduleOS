import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

// POST - Check out a worker
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const { userId, notes } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Verify user belongs to same organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found in your organization" }, { status: 404 })
    }

    // Workers can only check themselves out
    if (session.user.role === "WORKER" && userId !== session.user.id) {
      return NextResponse.json({ error: "You can only check yourself out" }, { status: 403 })
    }

    // Close the worker's open check-in, whichever calendar day it started on.
    // Looking up "today's" row broke every night shift that crossed midnight.
    const checkIn = await prisma.shiftCheckIn.findFirst({
      where: { userId, checkOutTime: null },
      orderBy: { checkInTime: "desc" },
    })

    if (!checkIn) {
      return NextResponse.json({ error: "No open check-in found" }, { status: 404 })
    }

    const now = new Date()

    const updated = await prisma.shiftCheckIn.update({
      where: { id: checkIn.id },
      data: {
        checkOutTime: now,
        notes: notes ? `${checkIn.notes || ""}\nCheckout: ${notes}`.trim() : checkIn.notes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `${targetUser.name || targetUser.email} checked out`,
    })
  } catch (error) {
    console.error("Error checking out:", error)
    return NextResponse.json({ error: "Failed to check out" }, { status: 500 })
  }
}

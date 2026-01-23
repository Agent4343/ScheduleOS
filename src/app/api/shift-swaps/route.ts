import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@prisma/client"
import { toUTCDate } from "@/lib/timezone"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const isAdmin = ["ADMIN", "SUPERVISOR"].includes(session.user.role)
    const where = {
      organizationId: session.user.organizationId,
      ...(status && { status }),
      ...(!isAdmin && {
        OR: [
          { requesterId: session.user.id },
          { targetUserId: session.user.id },
        ],
      }),
    }

    const swaps = await prisma.shiftSwapRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, data: swaps })
  } catch (error) {
    console.error("Error fetching shift swaps:", error)
    return NextResponse.json({ error: "Failed to fetch shift swaps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { targetUserId, date, reason } = body as {
      targetUserId?: string
      date?: string
      reason?: string
    }

    if (!targetUserId || !date) {
      return NextResponse.json({ error: "Target user and date are required" }, { status: 400 })
    }

    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: "You cannot request a swap with yourself" }, { status: 400 })
    }

    const swapDate = toUTCDate(date)
    if (Number.isNaN(swapDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }

    // Ensure target user is in same organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId: session.user.organizationId,
      },
      select: { id: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "Invalid target user" }, { status: 400 })
    }

    const existing = await prisma.shiftSwapRequest.findFirst({
      where: {
        organizationId: session.user.organizationId,
        requesterId: session.user.id,
        targetUserId,
        date: swapDate,
        status: "PENDING",
      },
    })

    if (existing) {
      return NextResponse.json({ error: "A pending swap request already exists for this date" }, { status: 400 })
    }

    // Ensure both users have schedules on the date
    const [requesterSchedule, targetSchedule] = await Promise.all([
      prisma.schedule.findFirst({
        where: {
          userId: session.user.id,
          date: swapDate,
        },
        select: { shiftType: true },
      }),
      prisma.schedule.findFirst({
        where: {
          userId: targetUserId,
          date: swapDate,
        },
        select: { shiftType: true },
      }),
    ])

    if (!requesterSchedule) {
      return NextResponse.json({ error: "You are not scheduled on that date" }, { status: 400 })
    }

    if (!targetSchedule) {
      return NextResponse.json({ error: "Target worker is not scheduled on that date" }, { status: 400 })
    }

    const swap = await prisma.shiftSwapRequest.create({
      data: {
        date: swapDate,
        shiftType: requesterSchedule.shiftType as ShiftType,
        reason: reason || null,
        requesterId: session.user.id,
        targetUserId,
        organizationId: session.user.organizationId,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
      },
    })

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "SHIFT_SWAP",
        title: "Shift swap request",
        message: `${session.user.name || session.user.email} requested a shift swap for ${date}.`,
        data: { requestId: swap.id },
      },
    })

    return NextResponse.json({ success: true, data: swap, message: "Shift swap requested" }, { status: 201 })
  } catch (error) {
    console.error("Error creating shift swap:", error)
    return NextResponse.json({ error: "Failed to create shift swap" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "14")

    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + days)

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: session.user.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        shiftType: true,
        customShiftCode: true,
        isOverride: true,
      },
    })

    // Get pending swap requests
    const pendingSwaps = await prisma.shiftSwap.findMany({
      where: {
        OR: [
          { requesterId: session.user.id },
          { targetId: session.user.id },
        ],
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      include: {
        requester: { select: { name: true } },
        target: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    })

    // Get pending time-off requests
    const pendingTimeOff = await prisma.timeOffRequest.findMany({
      where: {
        userId: session.user.id,
        status: "PENDING",
      },
      orderBy: { startDate: "asc" },
      take: 5,
    })

    // Next shift info
    const nextShift = schedules.find(s => !["OFF", "LEAVE", "VACATION", "SICK"].includes(s.shiftType))

    return NextResponse.json({
      success: true,
      data: {
        schedules,
        nextShift: nextShift || null,
        pendingSwaps,
        pendingTimeOff,
        daysShown: days,
      },
    })
  } catch (error) {
    console.error("Error fetching my schedule:", error)
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 })
  }
}

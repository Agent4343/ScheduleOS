import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { getTodayUTC } from "@/lib/timezone"

// GET - List attendance records
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const userId = searchParams.get("userId")

    // Workers can only see their own records
    const userFilter = session.user.role === "WORKER"
      ? session.user.id
      : userId || undefined

    const targetDate = date ? new Date(date) : getTodayUTC()

    const checkIns = await prisma.shiftCheckIn.findMany({
      where: {
        user: {
          organizationId: session.user.organizationId,
        },
        ...(userFilter && { userId: userFilter }),
        date: targetDate,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            crew: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        scannedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { checkInTime: "desc" },
    })

    return NextResponse.json({ success: true, data: checkIns })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 })
  }
}

// POST - Check in a worker (via QR scan)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
        status: "ACTIVE",
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found in your organization" }, { status: 404 })
    }

    // Workers can only check themselves in
    if (session.user.role === "WORKER" && userId !== session.user.id) {
      return NextResponse.json({ error: "You can only check yourself in" }, { status: 403 })
    }

    const today = getTodayUTC()
    const now = new Date()

    // Check if already checked in today
    const existing = await prisma.shiftCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Already checked in today", data: existing },
        { status: 409 }
      )
    }

    const checkIn = await prisma.shiftCheckIn.create({
      data: {
        userId,
        date: today,
        checkInTime: now,
        notes,
        scannedById: session.user.id !== userId ? session.user.id : null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: checkIn, message: `${targetUser.name || targetUser.email} checked in` },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error checking in:", error)
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 })
  }
}

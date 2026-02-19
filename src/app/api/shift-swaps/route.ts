import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const swaps = await prisma.shiftSwap.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(status && { status: status as "PENDING" | "ACCEPTED" | "DECLINED" | "APPROVED" | "CANCELLED" }),
        // Workers only see swaps they're involved in
        ...(session.user.role === "WORKER" && {
          OR: [
            { requesterId: session.user.id },
            { targetId: session.user.id },
          ],
        }),
      },
      include: {
        requester: { select: { id: true, name: true, email: true, crew: { select: { name: true, color: true } } } },
        target: { select: { id: true, name: true, email: true, crew: { select: { name: true, color: true } } } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: swaps })
  } catch (error) {
    console.error("Error fetching shift swaps:", error)
    return NextResponse.json({ error: "Failed to fetch shift swaps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const { targetId, date, shiftType, reason } = body

    if (!targetId || !date || !shiftType) {
      return NextResponse.json({ error: "Target worker, date, and shift type are required" }, { status: 400 })
    }

    if (targetId === session.user.id) {
      return NextResponse.json({ error: "Cannot swap with yourself" }, { status: 400 })
    }

    // Verify target exists in same organization
    const target = await prisma.user.findFirst({
      where: { id: targetId, organizationId: session.user.organizationId, status: "ACTIVE" },
    })

    if (!target) {
      return NextResponse.json({ error: "Target worker not found" }, { status: 404 })
    }

    // Check for duplicate pending swap
    const existing = await prisma.shiftSwap.findFirst({
      where: {
        requesterId: session.user.id,
        targetId,
        date: new Date(date),
        status: "PENDING",
      },
    })

    if (existing) {
      return NextResponse.json({ error: "You already have a pending swap request for this date and worker" }, { status: 400 })
    }

    const swap = await prisma.shiftSwap.create({
      data: {
        requesterId: session.user.id,
        targetId,
        date: new Date(date),
        shiftType,
        reason: reason || null,
        organizationId: session.user.organizationId,
      },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: swap, message: "Swap request created" }, { status: 201 })
  } catch (error) {
    console.error("Error creating shift swap:", error)
    return NextResponse.json({ error: "Failed to create shift swap" }, { status: 500 })
  }
}

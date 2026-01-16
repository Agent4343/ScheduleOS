import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { shiftType, notes, overrideReason } = body

    // Verify schedule belongs to organization
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id: params.id,
        user: {
          organizationId: session.user.organizationId,
        },
      },
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: {
        shiftType: shiftType ?? existingSchedule.shiftType,
        notes: notes !== undefined ? notes : existingSchedule.notes,
        overrideReason: overrideReason !== undefined ? overrideReason : existingSchedule.overrideReason,
        isOverride: true,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...schedule,
        date: schedule.date.toISOString().split('T')[0],
      },
    })
  } catch (error) {
    console.error("Error updating schedule:", error)
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify schedule belongs to organization
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id: params.id,
        user: {
          organizationId: session.user.organizationId,
        },
      },
    })

    if (!existingSchedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    await prisma.schedule.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: "Schedule deleted" })
  } catch (error) {
    console.error("Error deleting schedule:", error)
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 })
  }
}

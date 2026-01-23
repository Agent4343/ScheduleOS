import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { ShiftType } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const status = body?.status as "APPROVED" | "DENIED" | "CANCELLED"

    if (!status || !["APPROVED", "DENIED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const swap = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        requester: { select: { id: true } },
        targetUser: { select: { id: true } },
      },
    })

    if (!swap) {
      return NextResponse.json({ error: "Shift swap not found" }, { status: 404 })
    }

    const isAdmin = ["ADMIN", "SUPERVISOR"].includes(session.user.role)
    const isRequester = swap.requesterId === session.user.id

    if (status === "CANCELLED" && !isRequester && !isAdmin) {
      return NextResponse.json({ error: "Only the requester can cancel" }, { status: 403 })
    }

    if (["APPROVED", "DENIED"].includes(status) && !isAdmin) {
      return NextResponse.json({ error: "Only admins can approve or deny swaps" }, { status: 403 })
    }

    if (swap.status !== "PENDING") {
      return NextResponse.json({ error: "This request has already been processed" }, { status: 400 })
    }

    if (status === "APPROVED") {
      await prisma.$transaction(async (tx) => {
        const [requesterSchedule, targetSchedule] = await Promise.all([
          tx.schedule.findFirst({
            where: {
              userId: swap.requesterId,
              date: swap.date,
            },
          }),
          tx.schedule.findFirst({
            where: {
              userId: swap.targetUserId,
              date: swap.date,
            },
          }),
        ])

        if (!requesterSchedule || !targetSchedule) {
          throw new Error("Schedules not found for swap date.")
        }

        await Promise.all([
          tx.schedule.update({
            where: { id: requesterSchedule.id },
            data: {
              shiftType: targetSchedule.shiftType as ShiftType,
              customShiftCode: targetSchedule.customShiftCode,
              isOverride: true,
              overrideReason: "Shift swap approved",
            },
          }),
          tx.schedule.update({
            where: { id: targetSchedule.id },
            data: {
              shiftType: requesterSchedule.shiftType as ShiftType,
              customShiftCode: requesterSchedule.customShiftCode,
              isOverride: true,
              overrideReason: "Shift swap approved",
            },
          }),
          tx.shiftSwapRequest.update({
            where: { id: swap.id },
            data: {
              status,
              approvedById: session.user.id,
            },
          }),
        ])
      })
    } else {
      await prisma.shiftSwapRequest.update({
        where: { id: swap.id },
        data: {
          status,
          ...(status === "DENIED" && isAdmin ? { approvedById: session.user.id } : {}),
        },
      })
    }

    await prisma.notification.createMany({
      data: [
        {
          userId: swap.requesterId,
          type: "SHIFT_SWAP",
          title: `Shift swap ${status.toLowerCase()}`,
          message: `Your shift swap request for ${swap.date.toISOString().split("T")[0]} was ${status.toLowerCase()}.`,
          data: { requestId: swap.id },
        },
        {
          userId: swap.targetUserId,
          type: "SHIFT_SWAP",
          title: `Shift swap ${status.toLowerCase()}`,
          message: `Shift swap request for ${swap.date.toISOString().split("T")[0]} was ${status.toLowerCase()}.`,
          data: { requestId: swap.id },
        },
      ],
    })

    return NextResponse.json({ success: true, message: `Shift swap ${status.toLowerCase()}` })
  } catch (error) {
    console.error("Error updating shift swap:", error)
    return NextResponse.json({ error: "Failed to update shift swap" }, { status: 500 })
  }
}

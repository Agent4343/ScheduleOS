import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const swap = await prisma.shiftSwap.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })

    if (!swap) {
      return NextResponse.json({ error: "Swap request not found" }, { status: 404 })
    }

    const body = await request.json()
    const { action, adminNote } = body

    // Target worker can accept or decline
    if (action === "accept" || action === "decline") {
      if (swap.targetId !== session.user.id) {
        return NextResponse.json({ error: "Only the target worker can accept/decline" }, { status: 403 })
      }
      if (swap.status !== "PENDING") {
        return NextResponse.json({ error: "This swap is no longer pending" }, { status: 400 })
      }

      const updated = await prisma.shiftSwap.update({
        where: { id },
        data: { status: action === "accept" ? "ACCEPTED" : "DECLINED" },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          target: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({ success: true, data: updated })
    }

    // Admin can approve (finalize) or cancel
    if (action === "approve" || action === "cancel") {
      if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
        return NextResponse.json({ error: "Only admins/supervisors can approve or cancel swaps" }, { status: 403 })
      }

      if (action === "approve" && swap.status !== "ACCEPTED") {
        return NextResponse.json({ error: "Swap must be accepted by the target worker before admin approval" }, { status: 400 })
      }

      const newStatus = action === "approve" ? "APPROVED" : "CANCELLED"

      // If approving, actually swap the schedules
      if (action === "approve") {
        const swapDate = swap.date

        // Get both workers' schedules for that date
        const [requesterSchedule, targetSchedule] = await Promise.all([
          prisma.schedule.findFirst({ where: { userId: swap.requesterId, date: swapDate } }),
          prisma.schedule.findFirst({ where: { userId: swap.targetId, date: swapDate } }),
        ])

        // Swap the shift types
        const updates = []
        if (requesterSchedule && targetSchedule) {
          updates.push(
            prisma.schedule.update({
              where: { id: requesterSchedule.id },
              data: { shiftType: targetSchedule.shiftType, isOverride: true },
            }),
            prisma.schedule.update({
              where: { id: targetSchedule.id },
              data: { shiftType: requesterSchedule.shiftType, isOverride: true },
            })
          )
        }

        updates.push(
          prisma.shiftSwap.update({
            where: { id },
            data: { status: newStatus, adminNote: adminNote || null },
          })
        )

        await prisma.$transaction(updates)
      } else {
        await prisma.shiftSwap.update({
          where: { id },
          data: { status: newStatus, adminNote: adminNote || null },
        })
      }

      const updated = await prisma.shiftSwap.findFirst({
        where: { id },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          target: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({ success: true, data: updated })
    }

    // Requester can cancel their own request
    if (action === "withdraw") {
      if (swap.requesterId !== session.user.id) {
        return NextResponse.json({ error: "Only the requester can withdraw" }, { status: 403 })
      }
      if (!["PENDING", "ACCEPTED"].includes(swap.status)) {
        return NextResponse.json({ error: "Cannot withdraw at this stage" }, { status: 400 })
      }

      const updated = await prisma.shiftSwap.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          target: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({ success: true, data: updated })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating shift swap:", error)
    return NextResponse.json({ error: "Failed to update shift swap" }, { status: 500 })
  }
}

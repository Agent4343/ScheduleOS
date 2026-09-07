import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { swapShifts } from "@/lib/services/schedules"
import { ServiceError } from "@/lib/services/errors"

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

      // If approving, actually swap the schedules.
      //
      // This goes through the shared swapShifts service rather than writing
      // the rows here: it refuses when either worker has no shift on the day
      // (this route used to mark the swap APPROVED and silently change
      // nothing), it carries the duty code across as well as the shift type
      // (swapping only shiftType left a CUSTOM row with no code, which
      // disappears from coverage), and it writes the audit entry.
      if (action === "approve") {
        try {
          await swapShifts(
            { userId: session.user.id, organizationId: session.user.organizationId },
            {
              worker1Id: swap.requesterId,
              date1: swap.date,
              worker2Id: swap.targetId,
              date2: swap.date,
            }
          )
        } catch (error) {
          if (error instanceof ServiceError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      }

      await prisma.shiftSwap.update({
        where: { id },
        data: { status: newStatus, adminNote: adminNote || null },
      })

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

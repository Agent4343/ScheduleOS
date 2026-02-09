import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { Prisma } from "@prisma/client"

// DELETE: Cancel/delete a transfer request (for admins who created it)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can delete transfer requests
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify the transfer request belongs to this organization
    const transferRequest = await prisma.transferRequest.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!transferRequest) {
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 })
    }

    await prisma.transferRequest.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Transfer request cancelled",
    })
  } catch (error) {
    console.error("Error deleting transfer request:", error)
    return NextResponse.json({ error: "Failed to delete transfer request" }, { status: 500 })
  }
}

// POST: Accept or decline a transfer request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as "accept" | "decline"

    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Find the transfer request
    const transferRequest = await prisma.transferRequest.findFirst({
      where: {
        id: params.id,
        targetUserId: session.user.id,
        status: "PENDING",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!transferRequest) {
      return NextResponse.json({ error: "Transfer request not found" }, { status: 404 })
    }

    // Check if expired
    if (new Date() > transferRequest.expiresAt) {
      await prisma.transferRequest.update({
        where: { id: params.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "This transfer request has expired" }, { status: 410 })
    }

    if (action === "decline") {
      await prisma.transferRequest.update({
        where: { id: params.id },
        data: { status: "DECLINED" },
      })

      return NextResponse.json({
        success: true,
        message: "Transfer request declined",
      })
    }

    // Accept: Transfer the user to the new organization
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: {
          include: {
            _count: {
              select: { users: true },
            },
          },
        },
      },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user is the only admin in their current organization
    if (currentUser.role === "ADMIN" && currentUser.organizationId) {
      const adminCount = await prisma.user.count({
        where: {
          organizationId: currentUser.organizationId,
          role: "ADMIN",
        },
      })

      if (adminCount <= 1) {
        // Check if there are other users in the organization
        const userCount = await prisma.user.count({
          where: { organizationId: currentUser.organizationId },
        })

        if (userCount > 1) {
          return NextResponse.json(
            {
              error: "You are the only admin in your current organization. Please assign another admin before transferring, or remove all other users first.",
              code: "ONLY_ADMIN"
            },
            { status: 400 }
          )
        }
      }
    }

    // Perform the transfer in a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const oldOrgId = currentUser.organizationId

      // Update user's organization and role
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          organizationId: transferRequest.organizationId,
          role: transferRequest.role,
          crewId: null, // Remove crew assignment
          departmentId: null, // Remove department assignment
          customRoleId: null, // Remove custom role
        },
      })

      // Update the transfer request status
      await tx.transferRequest.update({
        where: { id: params.id },
        data: { status: "ACCEPTED" },
      })

      // Delete user's schedules from old organization
      await tx.schedule.deleteMany({
        where: { userId: session.user.id },
      })

      // Delete user's time off requests
      await tx.timeOffRequest.deleteMany({
        where: { userId: session.user.id },
      })

      // Delete any pending transfer requests to this user from other orgs
      await tx.transferRequest.deleteMany({
        where: {
          targetUserId: session.user.id,
          status: "PENDING",
          id: { not: params.id },
        },
      })

      // If user was the only member of their old organization, delete it
      if (oldOrgId) {
        const remainingUsers = await tx.user.count({
          where: { organizationId: oldOrgId },
        })

        if (remainingUsers === 0) {
          // Delete the empty organization (cascades to related data)
          await tx.organization.delete({
            where: { id: oldOrgId },
          })
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `You have joined ${transferRequest.organization.name}`,
      data: {
        organizationId: transferRequest.organizationId,
        organizationName: transferRequest.organization.name,
        role: transferRequest.role,
      },
    })
  } catch (error) {
    console.error("Error processing transfer request:", error)
    return NextResponse.json({ error: "Failed to process transfer request" }, { status: 500 })
  }
}

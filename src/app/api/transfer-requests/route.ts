import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const TRANSFER_REQUEST_EXPIRY_DAYS = 14

const createTransferRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "SUPERVISOR", "WORKER"]).default("WORKER"),
  message: z.string().max(500).optional(),
})

// GET: List transfer requests
// - For admins: outgoing requests from their organization
// - For all users: incoming requests to them
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "incoming"

    if (type === "outgoing") {
      // Admins can view outgoing transfer requests from their organization
      if (!session.user.organizationId) {
        return NextResponse.json({ error: "No organization" }, { status: 400 })
      }

      if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const requests = await prisma.transferRequest.findMany({
        where: {
          organizationId: session.user.organizationId,
        },
        include: {
          targetUser: {
            select: {
              id: true,
              email: true,
              name: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ success: true, data: requests })
    } else {
      // Users can view incoming transfer requests to them
      const requests = await prisma.transferRequest.findMany({
        where: {
          targetUserId: session.user.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ success: true, data: requests })
    }
  } catch (error) {
    console.error("Error fetching transfer requests:", error)
    return NextResponse.json({ error: "Failed to fetch transfer requests" }, { status: 500 })
  }
}

// POST: Create a transfer request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can create transfer requests
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createTransferRequestSchema.parse(body)

    // Find the user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "No user found with this email address" },
        { status: 404 }
      )
    }

    // Check if user is already in this organization
    if (targetUser.organizationId === session.user.organizationId) {
      return NextResponse.json(
        { error: "This user is already in your organization" },
        { status: 400 }
      )
    }

    // Check if there's already a pending transfer request
    const existingRequest = await prisma.transferRequest.findFirst({
      where: {
        organizationId: session.user.organizationId,
        targetUserId: targetUser.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: "A transfer request has already been sent to this user" },
        { status: 409 }
      )
    }

    // Get organization name for response
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    })

    // Create the transfer request
    const transferRequest = await prisma.transferRequest.create({
      data: {
        targetUserId: targetUser.id,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
        role: validatedData.role,
        message: validatedData.message,
        expiresAt: new Date(Date.now() + TRANSFER_REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    // Create a notification for the target user
    await prisma.notification.create({
      data: {
        userId: targetUser.id,
        type: "SYSTEM",
        title: "Organization Transfer Request",
        message: `${organization?.name || "An organization"} has invited you to join their team.`,
        data: {
          transferRequestId: transferRequest.id,
          organizationName: organization?.name,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: transferRequest,
      message: `Transfer request sent to ${targetUser.email}`,
    })
  } catch (error) {
    console.error("Error creating transfer request:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create transfer request" }, { status: 500 })
  }
}

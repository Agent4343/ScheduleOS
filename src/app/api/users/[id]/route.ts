import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { updateUserSchema } from "@/lib/validations"
import { logger } from "@/lib/logger"
import { audit, AuditAction, getClientInfo } from "@/lib/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        phone: true,
        status: true,
        hireDate: true,
        createdAt: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    logger.error("Error fetching user", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can update users
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify user belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Verify crew belongs to organization if provided
    if (validatedData.crewId) {
      const crew = await prisma.crew.findFirst({
        where: {
          id: validatedData.crewId,
          organizationId: session.user.organizationId,
        },
      })

      if (!crew) {
        return NextResponse.json({ error: "Invalid crew" }, { status: 400 })
      }
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: validatedData.name,
        role: validatedData.role,
        position: validatedData.position,
        phone: validatedData.phone,
        crewId: validatedData.crewId,
        hireDate: validatedData.hireDate,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        phone: true,
        status: true,
        hireDate: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    // Audit log for user update
    const clientInfo = getClientInfo(request)
    const changedFields = Object.keys(validatedData).filter(key => validatedData[key as keyof typeof validatedData] !== undefined)

    if (validatedData.role && validatedData.role !== existingUser.role) {
      audit(AuditAction.USER_ROLE_CHANGED, {
        userId: session.user.id,
        targetId: params.id,
        targetType: "user",
        organizationId: session.user.organizationId,
        metadata: { oldRole: existingUser.role, newRole: validatedData.role },
        ...clientInfo,
      })
    }

    audit(AuditAction.USER_UPDATED, {
      userId: session.user.id,
      targetId: params.id,
      targetType: "user",
      organizationId: session.user.organizationId,
      metadata: { changedFields },
      ...clientInfo,
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: "User updated successfully",
    })
  } catch (error) {
    logger.error("Error updating user", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
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

    // Only admins can delete users
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete users" }, { status: 403 })
    }

    // Prevent self-deletion
    if (params.id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }

    // Verify user belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    // Audit log for user deletion
    const clientInfo = getClientInfo(request)
    audit(AuditAction.USER_DELETED, {
      userId: session.user.id,
      targetId: params.id,
      targetType: "user",
      organizationId: session.user.organizationId,
      metadata: { deletedUserEmail: existingUser.email },
      ...clientInfo,
    })

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting user", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

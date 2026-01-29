import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { updateUserSchema } from "@/lib/validations"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getClientIP } from "@/lib/rate-limit"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const whereClause = {
      id: params.id,
      organizationId: session.user.organizationId,
    }

    // Try with customRole first, fall back without it if database hasn't been migrated
    let user
    try {
      user = await prisma.user.findFirst({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
          phone: true,
          status: true,
          hireDate: true,
          createdAt: true,
          customRoleId: true,
          crew: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          customRole: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      })
    } catch {
      // Fallback without customRole
      user = await prisma.user.findFirst({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
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
      if (user) {
        user = { ...user, customRoleId: null, customRole: null }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: user })
  } catch (error) {
    console.error("Error fetching user:", error)
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
      select: { id: true },
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

    // Try with customRoleId first, fall back without it if database hasn't been migrated
    let user

    // Build update data, only including defined fields (convert null to undefined for Prisma)
    const updateData: Record<string, unknown> = {}
    if (validatedData.name !== undefined && validatedData.name !== null) updateData.name = validatedData.name
    if (validatedData.email !== undefined && validatedData.email !== null) updateData.email = validatedData.email
    if (validatedData.role !== undefined) updateData.role = validatedData.role
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.positionType !== undefined) updateData.positionType = validatedData.positionType
    // These fields can be set to null to clear them
    if (validatedData.position !== undefined) updateData.position = validatedData.position
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone
    if (validatedData.crewId !== undefined) updateData.crewId = validatedData.crewId
    if (validatedData.customRoleId !== undefined) updateData.customRoleId = validatedData.customRoleId
    if (validatedData.hireDate !== undefined) updateData.hireDate = validatedData.hireDate
    if (validatedData.isControlRoomTrained !== undefined) updateData.isControlRoomTrained = validatedData.isControlRoomTrained
    if (validatedData.isOilOperatorTrained !== undefined) updateData.isOilOperatorTrained = validatedData.isOilOperatorTrained
    if (validatedData.isUtilityOperatorTrained !== undefined) updateData.isUtilityOperatorTrained = validatedData.isUtilityOperatorTrained
    if (validatedData.isGasOperatorTrained !== undefined) updateData.isGasOperatorTrained = validatedData.isGasOperatorTrained
    if (validatedData.includeInStaffingCount !== undefined) updateData.includeInStaffingCount = validatedData.includeInStaffingCount

    try {
      user = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
          phone: true,
          status: true,
          hireDate: true,
          isControlRoomTrained: true,
          isOilOperatorTrained: true,
          isUtilityOperatorTrained: true,
          isGasOperatorTrained: true,
          includeInStaffingCount: true,
          customRoleId: true,
          crew: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          customRole: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      })
    } catch {
      // Fallback without customRoleId if database hasn't been migrated
      // Remove customRoleId from update data for fallback
      const fallbackData = { ...updateData }
      delete fallbackData.customRoleId

      user = await prisma.user.update({
        where: { id: params.id },
        data: fallbackData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
          phone: true,
          status: true,
          hireDate: true,
          isControlRoomTrained: true,
          isOilOperatorTrained: true,
          isUtilityOperatorTrained: true,
          isGasOperatorTrained: true,
          includeInStaffingCount: true,
          crew: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      })
      user = { ...user, customRoleId: null, customRole: null }
    }

    // Log audit event
    await logAudit({
      action: AuditAction.USER_UPDATED,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      targetId: params.id,
      targetType: "User",
      metadata: {
        changes: validatedData,
      },
      ipAddress: getClientIP(request),
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Error updating user:", error)

    if (error instanceof Error && error.name === "ZodError") {
      // Extract specific validation errors
      const zodError = error as { errors?: Array<{ path: string[]; message: string }> }
      const validationErrors = zodError.errors?.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || []

      console.error("Validation errors:", validationErrors)

      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validationErrors
        },
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

    // Only admins and supervisors can delete users
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
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
      select: { id: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    // Log audit event
    await logAudit({
      action: AuditAction.USER_DELETED,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      targetId: params.id,
      targetType: "User",
      ipAddress: getClientIP(request),
    })

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}

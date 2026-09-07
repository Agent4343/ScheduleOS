import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { updateUserSchema } from "@/lib/validations"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getClientIP } from "@/lib/rate-limit"
import { checkUserChangeAllowed, wouldRemoveLastAdmin } from "@/lib/user-permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    // Verify user belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      select: { id: true, role: true, status: true },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Role and status changes are restricted (see user-permissions.ts)
    const denied = checkUserChangeAllowed({
      actorId: session.user.id,
      actorRole: session.user.role,
      targetId: existingUser.id,
      targetRole: existingUser.role,
      newRole: validatedData.role,
      newStatus: validatedData.status,
    })
    if (denied) {
      return NextResponse.json({ error: denied }, { status: 403 })
    }

    // Never leave the organization without an active admin
    if (validatedData.role !== undefined || validatedData.status !== undefined) {
      const activeAdminCount = await prisma.user.count({
        where: {
          organizationId: session.user.organizationId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      })
      const removesLastAdmin = wouldRemoveLastAdmin({
        targetRole: existingUser.role,
        targetStatus: existingUser.status,
        newRole: validatedData.role,
        newStatus: validatedData.status,
        activeAdminCount,
      })
      if (removesLastAdmin) {
        return NextResponse.json(
          { error: "Cannot remove the only active admin. Assign another admin first." },
          { status: 400 }
        )
      }
    }

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
        email: validatedData.email,
        role: validatedData.role,
        position: validatedData.position,
        positionType: validatedData.positionType,
        phone: validatedData.phone,
        crewId: validatedData.crewId,
        hireDate: validatedData.hireDate,
        status: validatedData.status,
      },
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
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    // Log audit event
    await logAudit({
      action: AuditAction.USER_UPDATED,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      targetId: params.id,
      targetType: "User",
      metadata: {
        // updateUserSchema has no password field, so nothing secret lands here.
        // Record which fields changed rather than every value.
        changedFields: Object.keys(validatedData),
        ...(validatedData.role !== undefined && { role: validatedData.role }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
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
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { session } = auth

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

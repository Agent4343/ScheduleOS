import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { updateUserSchema } from "@/lib/validations"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getClientIP } from "@/lib/rate-limit"
import { updateWorker } from "@/lib/services/workers"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"

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

    const validatedData = await parseBody(updateUserSchema, request)

    // Role/status rules, crew check and audit live in the service (shared
    // with the AI assistant's update_worker tool).
    const user = await updateWorker(
      {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        role: session.user.role,
        ipAddress: getClientIP(request),
      },
      params.id,
      validatedData
    )

    return apiOk(user, { message: "User updated successfully" })
  } catch (error) {
    return handleRouteError(error, "Failed to update user")
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

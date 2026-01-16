import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const user = await prisma.user.findFirst({
      where: {
        id,
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
        rotationGroup: true,
        primaryPosition: true,
        isCCRQualified: true,
        isPSCapable: true,
        isPLCapable: true,
        qualifications: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
            code: true,
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
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    // Verify user belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()

    // Only admins can assign or change to ADMIN role
    if (body.role === "ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can assign the ADMIN role" }, { status: 403 })
    }

    // Prevent non-admins from demoting admins
    if (existingUser.role === "ADMIN" && body.role && body.role !== "ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can change an admin's role" }, { status: 403 })
    }

    // Verify crew belongs to organization if provided
    if (body.crewId) {
      const crew = await prisma.crew.findFirst({
        where: {
          id: body.crewId,
          organizationId: session.user.organizationId,
        },
      })

      if (!crew) {
        return NextResponse.json({ error: "Invalid crew" }, { status: 400 })
      }
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.role !== undefined) updateData.role = body.role
    if (body.position !== undefined) updateData.position = body.position
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.crewId !== undefined) updateData.crewId = body.crewId || null
    if (body.hireDate !== undefined) {
      updateData.hireDate = body.hireDate ? new Date(body.hireDate) : null
    }
    if (body.status !== undefined) updateData.status = body.status

    // Offshore specific fields
    if (body.rotationGroup !== undefined) updateData.rotationGroup = body.rotationGroup || null
    if (body.primaryPosition !== undefined) updateData.primaryPosition = body.primaryPosition || null
    if (body.isCCRQualified !== undefined) updateData.isCCRQualified = body.isCCRQualified
    if (body.isPSCapable !== undefined) updateData.isPSCapable = body.isPSCapable
    if (body.isPLCapable !== undefined) updateData.isPLCapable = body.isPLCapable
    if (body.qualifications !== undefined) updateData.qualifications = body.qualifications

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        phone: true,
        status: true,
        hireDate: true,
        rotationGroup: true,
        primaryPosition: true,
        isCCRQualified: true,
        isPSCapable: true,
        isPLCapable: true,
        qualifications: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
            code: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: user,
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
    }

    // Verify user belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await prisma.user.delete({
      where: { id },
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

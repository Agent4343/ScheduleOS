import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isDefault: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const department = await prisma.department.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        users: {
          select: { id: true, name: true, email: true },
        },
        crews: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: { users: true, crews: true },
        },
      },
    })

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: department })
  } catch (error) {
    console.error("Error fetching department:", error)
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 })
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update departments" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateDepartmentSchema.parse(body)

    // Verify department exists and belongs to organization
    const existing = await prisma.department.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (validatedData.isDefault) {
      await prisma.department.updateMany({
        where: {
          organizationId: session.user.organizationId,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    // Check for duplicate name if name is being changed
    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicate = await prisma.department.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: validatedData.name,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A department with this name already exists" },
          { status: 400 }
        )
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: { users: true, crews: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: department,
      message: "Department updated successfully",
    })
  } catch (error) {
    console.error("Error updating department:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete departments" }, { status: 403 })
    }

    const { id } = await params

    // Verify department exists and belongs to organization
    const existing = await prisma.department.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { users: true, crews: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    // Don't allow deleting the default department if there are other departments
    if (existing.isDefault) {
      const otherDepartments = await prisma.department.count({
        where: {
          organizationId: session.user.organizationId,
          id: { not: id },
        },
      })

      if (otherDepartments > 0) {
        return NextResponse.json(
          { error: "Cannot delete the default department. Set another department as default first." },
          { status: 400 }
        )
      }
    }

    // Clear department from users and crews before deleting
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      }),
      prisma.crew.updateMany({
        where: { departmentId: id },
        data: { departmentId: null },
      }),
      prisma.department.delete({
        where: { id },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: "Department deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting department:", error)
    return NextResponse.json({ error: "Failed to delete department" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const departments = await prisma.department.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        _count: {
          select: { users: true, crews: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: departments })
  } catch (error) {
    console.error("Error fetching departments:", error)
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create departments
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create departments" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createDepartmentSchema.parse(body)

    // Check for duplicate name
    const existingDepartment = await prisma.department.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existingDepartment) {
      return NextResponse.json(
        { error: "A department with this name already exists" },
        { status: 400 }
      )
    }

    // Check if this is the first department (make it default)
    const departmentCount = await prisma.department.count({
      where: { organizationId: session.user.organizationId },
    })

    const department = await prisma.department.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color || "#3B82F6",
        isDefault: departmentCount === 0,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { users: true, crews: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: department, message: "Department created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating department:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create department" }, { status: 500 })
  }
}

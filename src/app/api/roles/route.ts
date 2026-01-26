import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must be at most 50 characters"),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  baseRole: z.enum(["ADMIN", "SUPERVISOR", "WORKER"]).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roles = await prisma.customRole.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: roles })
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create roles
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create roles" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createRoleSchema.parse(body)

    // Check if role name already exists
    const existingRole = await prisma.customRole.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existingRole) {
      return NextResponse.json(
        { error: "A role with this name already exists" },
        { status: 400 }
      )
    }

    const role = await prisma.customRole.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || null,
        color: validatedData.color || "#6b7280",
        baseRole: validatedData.baseRole || "WORKER",
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: role, message: "Role created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating role:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
  }
}

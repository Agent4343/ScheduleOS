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

    try {
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
    } catch (dbError) {
      // If table doesn't exist, return empty array
      console.error("CustomRole table may not exist:", dbError)
      return NextResponse.json({ success: true, data: [] })
    }
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

    // Only admins and supervisors can create roles
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createRoleSchema.parse(body)

    // Try to check if role name already exists - this will fail if table doesn't exist
    try {
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
    } catch (dbCheckError) {
      const errorMsg = dbCheckError instanceof Error ? dbCheckError.message : String(dbCheckError)
      console.error("Database check error:", errorMsg)

      if (errorMsg.includes("does not exist") || errorMsg.includes("relation") || errorMsg.includes("CustomRole")) {
        return NextResponse.json(
          { error: "Custom roles table not found. Please redeploy the application to run database migrations." },
          { status: 503 }
        )
      }
      throw dbCheckError
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

    // Check if it's a database error (table doesn't exist)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes("does not exist") || errorMessage.includes("relation") || errorMessage.includes("CustomRole")) {
      return NextResponse.json(
        { error: "Custom roles table not found. Please redeploy the application to run database migrations." },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: "Failed to create role" }, { status: 500 })
  }
}

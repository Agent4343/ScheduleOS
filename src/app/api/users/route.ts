import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { authOptions, hashPassword } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const crewId = searchParams.get("crewId")
    const status = searchParams.get("status")
    const role = searchParams.get("role")

    const users = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(crewId && { crewId }),
        ...(status && { status: status as "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED" }),
        ...(role && { role: role as "ADMIN" | "SUPERVISOR" | "WORKER" }),
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
        // Offshore specific fields
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
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can create users
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Basic validation
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "Email and name are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Verify crew belongs to organization
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

    // Hash password if provided
    const passwordHash = body.password
      ? await hashPassword(body.password)
      : null

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        role: body.role || "WORKER",
        position: body.position || null,
        phone: body.phone || null,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        crewId: body.crewId || null,
        organizationId: session.user.organizationId,
        passwordHash,
        status: "ACTIVE",
        // Offshore specific fields
        rotationGroup: body.rotationGroup || null,
        primaryPosition: body.primaryPosition || null,
        isCCRQualified: body.isCCRQualified || false,
        isPSCapable: body.isPSCapable || false,
        isPLCapable: body.isPLCapable || false,
        qualifications: body.qualifications || [],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        status: true,
        rotationGroup: true,
        primaryPosition: true,
        isCCRQualified: true,
        isPSCapable: true,
        isPLCapable: true,
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

    return NextResponse.json(
      { success: true, data: user, message: "User created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

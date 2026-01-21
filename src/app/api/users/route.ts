import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions, hashPassword } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations"
import { logger } from "@/lib/logger"

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
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        positionCategory: {
          select: {
            id: true,
            name: true,
            code: true,
            isOffshore: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    logger.error("Error fetching users", error)
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
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Verify crew belongs to organization
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

    // Verify position category belongs to organization
    if (validatedData.positionCategoryId) {
      const positionCategory = await prisma.positionCategory.findFirst({
        where: {
          id: validatedData.positionCategoryId,
          organizationId: session.user.organizationId,
        },
      })

      if (!positionCategory) {
        return NextResponse.json({ error: "Invalid position category" }, { status: 400 })
      }
    }

    // Hash password if provided
    const passwordHash = validatedData.password
      ? await hashPassword(validatedData.password)
      : null

    const user = await prisma.user.create({
      data: {
        email: validatedData.email.toLowerCase(),
        name: validatedData.name,
        role: validatedData.role,
        position: validatedData.position,
        phone: validatedData.phone,
        hireDate: validatedData.hireDate,
        crewId: validatedData.crewId,
        positionCategoryId: validatedData.positionCategoryId,
        organizationId: session.user.organizationId,
        passwordHash,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        status: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        positionCategory: {
          select: {
            id: true,
            name: true,
            code: true,
            isOffshore: true,
          },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: user, message: "User created successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error creating user", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

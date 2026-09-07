import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { hashPassword } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations"
import { checkUserCreateAllowed } from "@/lib/user-permissions"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
      orderBy: [{ name: "asc" }],
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Supervisors may only create worker accounts
    const denied = checkUserCreateAllowed(session.user.role, validatedData.role)
    if (denied) {
      return NextResponse.json({ error: denied }, { status: 403 })
    }

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
        positionType: validatedData.positionType,
        phone: validatedData.phone,
        hireDate: validatedData.hireDate,
        crewId: validatedData.crewId,
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
        positionType: true,
        status: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
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

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

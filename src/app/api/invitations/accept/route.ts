import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { acceptInvitationSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"

// GET: Validate invitation token and return invitation details
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        expiresAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation", code: "INVALID_TOKEN" },
        { status: 404 }
      )
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired", code: "EXPIRED" },
        { status: 410 }
      )
    }

    // Check if email is already registered in this organization
    const existingUser = await prisma.user.findFirst({
      where: {
        email: invitation.email,
        organizationId: invitation.organization.id,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already registered", code: "ALREADY_REGISTERED" },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        organizationName: invitation.organization.name,
      },
    })
  } catch (error) {
    console.error("Error validating invitation:", error)
    return NextResponse.json({ error: "Failed to validate invitation" }, { status: 500 })
  }
}

// POST: Accept invitation and create user account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = acceptInvitationSchema.parse(body)

    const invitation = await prisma.invitation.findUnique({
      where: { token: validatedData.token },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        expiresAt: true,
        organizationId: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation", code: "INVALID_TOKEN" },
        { status: 404 }
      )
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { error: "This invitation has expired", code: "EXPIRED" },
        { status: 410 }
      )
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findFirst({
      where: {
        email: invitation.email,
        organizationId: invitation.organizationId,
      },
    })

    if (existingUser) {
      // Delete the invitation since it's no longer needed
      await prisma.invitation.delete({ where: { id: invitation.id } })
      return NextResponse.json(
        { error: "This email is already registered", code: "ALREADY_REGISTERED" },
        { status: 409 }
      )
    }

    // Hash the password
    const passwordHash = await hashPassword(validatedData.password)

    // Create user and delete invitation in a transaction
    const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          passwordHash,
          status: "ACTIVE",
          organizationId: invitation.organizationId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      })

      // Delete the invitation
      await tx.invitation.delete({ where: { id: invitation.id } })

      return newUser
    })

    return NextResponse.json({
      success: true,
      message: "Account created successfully. You can now log in.",
      data: {
        email: user.email,
        name: user.name,
        organizationName: invitation.organization.name,
      },
    })
  } catch (error) {
    console.error("Error accepting invitation:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 })
  }
}

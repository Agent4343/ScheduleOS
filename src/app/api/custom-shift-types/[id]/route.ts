import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const updateCustomShiftTypeSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase().optional(),
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  description: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
})

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

    const customShiftType = await prisma.customShiftType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!customShiftType) {
      return NextResponse.json({ error: "Custom shift type not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: customShiftType })
  } catch (error) {
    console.error("Error fetching custom shift type:", error)
    return NextResponse.json({ error: "Failed to fetch custom shift type" }, { status: 500 })
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

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCustomShiftTypeSchema.parse(body)

    // Verify the shift type belongs to the organization
    const existing = await prisma.customShiftType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Custom shift type not found" }, { status: 404 })
    }

    // If code is being changed, check for duplicates
    if (validatedData.code && validatedData.code !== existing.code) {
      const duplicate = await prisma.customShiftType.findFirst({
        where: {
          organizationId: session.user.organizationId,
          code: validatedData.code.toUpperCase(),
          NOT: { id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A shift type with this code already exists" },
          { status: 400 }
        )
      }
    }

    const customShiftType = await prisma.customShiftType.update({
      where: { id },
      data: {
        ...validatedData,
        code: validatedData.code?.toUpperCase(),
      },
    })

    return NextResponse.json({ success: true, data: customShiftType })
  } catch (error) {
    console.error("Error updating custom shift type:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update custom shift type" }, { status: 500 })
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

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params

    // Verify the shift type belongs to the organization
    const existing = await prisma.customShiftType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Custom shift type not found" }, { status: 404 })
    }

    await prisma.customShiftType.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Custom shift type deleted" })
  } catch (error) {
    console.error("Error deleting custom shift type:", error)
    return NextResponse.json({ error: "Failed to delete custom shift type" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const createCustomShiftTypeSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  description: z.string().max(200).optional(),
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const customShiftTypes = await prisma.customShiftType.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: customShiftTypes })
  } catch (error) {
    console.error("Error fetching custom shift types:", error)
    return NextResponse.json({ error: "Failed to fetch custom shift types" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCustomShiftTypeSchema.parse(body)

    // Check if code already exists
    const existing = await prisma.customShiftType.findFirst({
      where: {
        organizationId: session.user.organizationId,
        code: validatedData.code.toUpperCase(),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A shift type with this code already exists" },
        { status: 400 }
      )
    }

    const customShiftType = await prisma.customShiftType.create({
      data: {
        code: validatedData.code.toUpperCase(),
        name: validatedData.name,
        color: validatedData.color,
        textColor: validatedData.textColor || "#ffffff",
        description: validatedData.description,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json(
      { success: true, data: customShiftType, message: "Custom shift type created" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating custom shift type:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create custom shift type" }, { status: 500 })
  }
}

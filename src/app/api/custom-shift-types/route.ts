import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { z } from "zod"

const createCustomShiftTypeSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  description: z.string().max(200).optional(),
  // Role-based coverage
  coverageShift: z.enum(["DAY", "NIGHT"]).nullable().optional(),
  coverageRoleId: z.string().nullable().optional(),
  isBackfill: z.boolean().optional(),
})

export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

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
        coverageShift: validatedData.coverageShift ?? null,
        coverageRoleId: validatedData.coverageRoleId ?? null,
        isBackfill: validatedData.isBackfill ?? false,
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
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create custom shift type" }, { status: 500 })
  }
}

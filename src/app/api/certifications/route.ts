import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const createCertificationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isRequired: z.boolean().optional(),
  requireOnSchedule: z.boolean().optional(),
  minPerDayShift: z.number().int().min(1).optional(),
  minPerNightShift: z.number().int().min(1).optional(),
  expiryWarningDays: z.number().int().min(7).optional(),
})

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const certifications = await prisma.certificationType.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: { userCertifications: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: certifications })
  } catch (error) {
    console.error("Error fetching certifications:", error)
    return NextResponse.json({ error: "Failed to fetch certifications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create certification types
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can create certification types" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createCertificationSchema.parse(body)

    // Check for duplicate name
    const existing = await prisma.certificationType.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A certification with this name already exists" },
        { status: 400 }
      )
    }

    const certification = await prisma.certificationType.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color || "#3B82F6",
        isRequired: validatedData.isRequired || false,
        requireOnSchedule: validatedData.requireOnSchedule || false,
        minPerDayShift: validatedData.minPerDayShift || 1,
        minPerNightShift: validatedData.minPerNightShift || 1,
        expiryWarningDays: validatedData.expiryWarningDays || 180,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { userCertifications: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: certification, message: "Certification type created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating certification:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create certification" }, { status: 500 })
  }
}

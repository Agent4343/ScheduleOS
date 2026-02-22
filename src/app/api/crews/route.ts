import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { createCrewSchema } from "@/lib/validations"

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const crews = await prisma.crew.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        rotationPattern: {
          select: {
            id: true,
            name: true,
            daysOn: true,
            daysOff: true,
            includesNights: true,
          },
        },
        _count: {
          select: { workers: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: crews })
  } catch (error) {
    console.error("Error fetching crews:", error)
    return NextResponse.json({ error: "Failed to fetch crews" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const validatedData = createCrewSchema.parse(body)

    // Check for duplicate name
    const existingCrew = await prisma.crew.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existingCrew) {
      return NextResponse.json(
        { error: "A crew with this name already exists" },
        { status: 400 }
      )
    }

    // Verify rotation pattern if provided
    if (validatedData.rotationPatternId) {
      const pattern = await prisma.rotationPattern.findFirst({
        where: {
          id: validatedData.rotationPatternId,
          organizationId: session.user.organizationId,
        },
      })

      if (!pattern) {
        return NextResponse.json({ error: "Invalid rotation pattern" }, { status: 400 })
      }
    }

    const crew = await prisma.crew.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        organizationId: session.user.organizationId,
        rotationPatternId: validatedData.rotationPatternId,
      },
      include: {
        rotationPattern: {
          select: {
            id: true,
            name: true,
            daysOn: true,
            daysOff: true,
          },
        },
        _count: {
          select: { workers: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: crew, message: "Crew created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating crew:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create crew" }, { status: 500 })
  }
}

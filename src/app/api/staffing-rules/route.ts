import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { createStaffingRuleSchema } from "@/lib/validations"
import { ShiftType } from "@prisma/client"
import { PositionType } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { searchParams } = new URL(request.url)
    const crewId = searchParams.get("crewId")
    const shiftType = searchParams.get("shiftType")
    const positionType = searchParams.get("positionType")
    const isActive = searchParams.get("isActive")

    const rules = await prisma.staffingRule.findMany({
      where: {
        organizationId: session.user.organizationId,
        ...(crewId && { crewId }),
        ...(shiftType && { shiftType: shiftType as ShiftType }),
        ...(positionType && { positionType: positionType as PositionType }),
        ...(isActive !== null && { isActive: isActive === "true" }),
      },
      include: {
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    console.error("Error fetching staffing rules:", error)
    return NextResponse.json({ error: "Failed to fetch staffing rules" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const validatedData = createStaffingRuleSchema.parse(body)

    // Check for duplicate name
    const existingRule = await prisma.staffingRule.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existingRule) {
      return NextResponse.json(
        { error: "A staffing rule with this name already exists" },
        { status: 400 }
      )
    }

    // Verify crew belongs to organization if provided
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

    const rule = await prisma.staffingRule.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        shiftType: validatedData.shiftType,
        minWorkers: validatedData.minWorkers,
        maxVacation: validatedData.maxVacation,
        role: validatedData.role,
        positionType: validatedData.positionType,
        crewId: validatedData.crewId,
        priority: validatedData.priority,
        isActive: validatedData.isActive,
        organizationId: session.user.organizationId,
      },
      include: {
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
      { success: true, data: rule, message: "Staffing rule created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating staffing rule:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create staffing rule" }, { status: 500 })
  }
}

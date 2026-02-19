import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { createStaffingRuleSchema } from "@/lib/validations"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const rule = await prisma.staffingRule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        crew: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    if (!rule) {
      return NextResponse.json({ error: "Staffing rule not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: rule })
  } catch (error) {
    console.error("Error fetching staffing rule:", error)
    return NextResponse.json({ error: "Failed to fetch staffing rule" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const existing = await prisma.staffingRule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Staffing rule not found" }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = createStaffingRuleSchema.partial().parse(body)

    // Check for duplicate name if name is being changed
    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicate = await prisma.staffingRule.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: validatedData.name,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A staffing rule with this name already exists" },
          { status: 400 }
        )
      }
    }

    // Verify crew if changing
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

    const rule = await prisma.staffingRule.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.shiftType !== undefined && { shiftType: validatedData.shiftType }),
        ...(validatedData.minWorkers !== undefined && { minWorkers: validatedData.minWorkers }),
        ...(validatedData.maxVacation !== undefined && { maxVacation: validatedData.maxVacation }),
        ...(validatedData.role !== undefined && { role: validatedData.role }),
        ...(validatedData.positionType !== undefined && { positionType: validatedData.positionType }),
        ...(validatedData.crewId !== undefined && { crewId: validatedData.crewId }),
        ...(validatedData.priority !== undefined && { priority: validatedData.priority }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
      },
      include: {
        crew: {
          select: { id: true, name: true, color: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: rule })
  } catch (error) {
    console.error("Error updating staffing rule:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update staffing rule" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth
    const { id } = await params

    const existing = await prisma.staffingRule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Staffing rule not found" }, { status: 404 })
    }

    await prisma.staffingRule.delete({ where: { id } })

    return NextResponse.json({ success: true, message: "Staffing rule deleted" })
  } catch (error) {
    console.error("Error deleting staffing rule:", error)
    return NextResponse.json({ error: "Failed to delete staffing rule" }, { status: 500 })
  }
}

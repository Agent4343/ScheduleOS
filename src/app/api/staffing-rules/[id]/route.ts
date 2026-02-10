import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { updateStaffingRuleSchema } from "@/lib/validations"
import { ZodError } from "zod"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

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
    const validatedData = updateStaffingRuleSchema.parse(body)

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

    if (error instanceof ZodError) {
      const fieldErrors = error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ")
      return NextResponse.json(
        { error: `Validation failed: ${fieldErrors}`, details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update staffing rule" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

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

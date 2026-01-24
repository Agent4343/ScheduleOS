import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { updateStaffingRuleSchema } from "@/lib/validations"
import { ShiftType } from "@prisma/client"
import { PositionType } from "@/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update staffing rules" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateStaffingRuleSchema.parse(body)

    const existingRule = await prisma.staffingRule.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      select: { id: true, crewId: true },
    })

    if (!existingRule) {
      return NextResponse.json({ error: "Staffing rule not found" }, { status: 404 })
    }

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
      where: { id: params.id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.shiftType !== undefined && { shiftType: validatedData.shiftType as ShiftType }),
        ...(validatedData.minWorkers !== undefined && { minWorkers: validatedData.minWorkers }),
        ...(validatedData.maxVacation !== undefined && { maxVacation: validatedData.maxVacation }),
        ...(validatedData.role !== undefined && { role: validatedData.role }),
        ...(validatedData.positionType !== undefined && { positionType: validatedData.positionType as PositionType }),
        ...(validatedData.crewId !== undefined && { crewId: validatedData.crewId }),
        ...(validatedData.priority !== undefined && { priority: validatedData.priority }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
      },
      include: {
        crew: { select: { id: true, name: true, color: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: rule,
      message: "Staffing rule updated successfully",
    })
  } catch (error) {
    console.error("Error updating staffing rule:", error)
    return NextResponse.json({ error: "Failed to update staffing rule" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete staffing rules" }, { status: 403 })
    }

    const existingRule = await prisma.staffingRule.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      select: { id: true },
    })

    if (!existingRule) {
      return NextResponse.json({ error: "Staffing rule not found" }, { status: 404 })
    }

    await prisma.staffingRule.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Staffing rule deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting staffing rule:", error)
    return NextResponse.json({ error: "Failed to delete staffing rule" }, { status: 500 })
  }
}

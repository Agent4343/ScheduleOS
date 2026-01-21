import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createRotationPatternSchema } from "@/lib/validations"
import { logger } from "@/lib/logger"

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const patterns = await prisma.rotationPattern.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        _count: {
          select: { crews: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: patterns })
  } catch (error) {
    logger.error("Error fetching rotation patterns", error)
    return NextResponse.json({ error: "Failed to fetch rotation patterns" }, { status: 500 })
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
    const validatedData = createRotationPatternSchema.parse(body)

    // Check for duplicate name
    const existingPattern = await prisma.rotationPattern.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
      },
    })

    if (existingPattern) {
      return NextResponse.json(
        { error: "A rotation pattern with this name already exists" },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults
    if (validatedData.isDefault) {
      await prisma.rotationPattern.updateMany({
        where: {
          organizationId: session.user.organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    const pattern = await prisma.rotationPattern.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        daysOn: validatedData.daysOn,
        daysOff: validatedData.daysOff,
        includesNights: validatedData.includesNights,
        nightsAtStart: validatedData.nightsAtStart,
        nightDays: validatedData.nightDays,
        alternatesShifts: validatedData.alternatesShifts,
        isDefault: validatedData.isDefault,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json(
      { success: true, data: pattern, message: "Rotation pattern created successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error creating rotation pattern", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data" },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create rotation pattern" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const patternId = searchParams.get("id")

    if (!patternId) {
      return NextResponse.json({ error: "Pattern ID is required" }, { status: 400 })
    }

    // Verify pattern belongs to organization
    const existingPattern = await prisma.rotationPattern.findFirst({
      where: {
        id: patternId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    const body = await request.json()

    // Check for duplicate name (excluding current pattern)
    if (body.name && body.name !== existingPattern.name) {
      const duplicateName = await prisma.rotationPattern.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: body.name,
          id: { not: patternId },
        },
      })

      if (duplicateName) {
        return NextResponse.json(
          { error: "A rotation pattern with this name already exists" },
          { status: 400 }
        )
      }
    }

    const pattern = await prisma.rotationPattern.update({
      where: { id: patternId },
      data: {
        name: body.name,
        description: body.description,
        daysOn: body.daysOn,
        daysOff: body.daysOff,
        includesNights: body.includesNights,
        nightsAtStart: body.nightsAtStart,
        nightDays: body.nightDays,
        alternatesShifts: body.alternatesShifts,
      },
    })

    return NextResponse.json({
      success: true,
      data: pattern,
      message: "Rotation pattern updated successfully",
    })
  } catch (error) {
    console.error("Error updating rotation pattern:", error)
    return NextResponse.json({ error: "Failed to update rotation pattern" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete patterns" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const patternId = searchParams.get("id")

    if (!patternId) {
      return NextResponse.json({ error: "Pattern ID is required" }, { status: 400 })
    }

    // Verify pattern belongs to organization
    const existingPattern = await prisma.rotationPattern.findFirst({
      where: {
        id: patternId,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: { select: { crews: true } },
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    // Check if pattern is in use
    if (existingPattern._count.crews > 0) {
      return NextResponse.json(
        { error: "Cannot delete pattern that is assigned to crews" },
        { status: 400 }
      )
    }

    await prisma.rotationPattern.delete({
      where: { id: patternId },
    })

    return NextResponse.json({
      success: true,
      message: "Rotation pattern deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting rotation pattern:", error)
    return NextResponse.json({ error: "Failed to delete rotation pattern" }, { status: 500 })
  }
}

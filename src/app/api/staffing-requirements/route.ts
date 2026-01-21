import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shiftType = searchParams.get("shiftType")
    const date = searchParams.get("date")

    const requirements = await prisma.staffingRequirement.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
        ...(shiftType && { shiftType: shiftType as "DAY" | "NIGHT" }),
      },
      include: {
        positionCategory: {
          select: {
            id: true,
            name: true,
            code: true,
            isOffshore: true,
          },
        },
      },
      orderBy: {
        positionCategory: { sortOrder: "asc" },
      },
    })

    // If a date is provided, also return current staffing levels
    if (date) {
      const staffingStatus = await getStaffingStatus(
        session.user.organizationId,
        new Date(date),
        requirements
      )
      return NextResponse.json({ success: true, data: requirements, staffingStatus })
    }

    return NextResponse.json({ success: true, data: requirements })
  } catch (error) {
    logger.error("Error fetching staffing requirements", error)
    return NextResponse.json({ error: "Failed to fetch staffing requirements" }, { status: 500 })
  }
}

async function getStaffingStatus(
  organizationId: string,
  date: Date,
  requirements: {
    id: string
    shiftType: string
    minRequired: number
    idealCount: number | null
    positionCategory: { id: string; name: string; code: string }
  }[]
) {
  // Get all schedules for the date
  const schedules = await prisma.schedule.findMany({
    where: {
      user: { organizationId },
      date: {
        gte: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
        lt: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1)),
      },
      shiftType: { in: ["DAY", "NIGHT"] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          positionCategoryId: true,
          positionCategory: {
            select: { id: true, name: true, code: true },
          },
        },
      },
    },
  })

  // Group by position category and shift type
  const staffingStatus: {
    positionCategoryId: string
    positionCategoryName: string
    shiftType: string
    minRequired: number
    idealCount: number | null
    currentCount: number
    isMet: boolean
    workers: { id: string; name: string | null }[]
  }[] = []

  for (const req of requirements) {
    const workersOnShift = schedules.filter(
      (s) =>
        s.shiftType === req.shiftType &&
        s.user.positionCategoryId === req.positionCategory.id
    )

    staffingStatus.push({
      positionCategoryId: req.positionCategory.id,
      positionCategoryName: req.positionCategory.name,
      shiftType: req.shiftType,
      minRequired: req.minRequired,
      idealCount: req.idealCount,
      currentCount: workersOnShift.length,
      isMet: workersOnShift.length >= req.minRequired,
      workers: workersOnShift.map((s) => ({
        id: s.user.id,
        name: s.user.name,
      })),
    })
  }

  return staffingStatus
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
    const { positionCategoryId, shiftType, minRequired, idealCount } = body

    if (!positionCategoryId || !shiftType || minRequired === undefined) {
      return NextResponse.json(
        { error: "Position category, shift type, and minimum required are required" },
        { status: 400 }
      )
    }

    // Verify position category belongs to organization
    const category = await prisma.positionCategory.findFirst({
      where: {
        id: positionCategoryId,
        organizationId: session.user.organizationId,
      },
    })

    if (!category) {
      return NextResponse.json({ error: "Position category not found" }, { status: 404 })
    }

    // Check for existing requirement
    const existing = await prisma.staffingRequirement.findFirst({
      where: {
        organizationId: session.user.organizationId,
        positionCategoryId,
        shiftType,
      },
    })

    if (existing) {
      // Update existing
      const requirement = await prisma.staffingRequirement.update({
        where: { id: existing.id },
        data: {
          minRequired,
          idealCount,
          isActive: true,
        },
        include: {
          positionCategory: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      return NextResponse.json({
        success: true,
        data: requirement,
        message: "Staffing requirement updated successfully",
      })
    }

    const requirement = await prisma.staffingRequirement.create({
      data: {
        positionCategoryId,
        shiftType,
        minRequired,
        idealCount,
        organizationId: session.user.organizationId,
      },
      include: {
        positionCategory: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: requirement, message: "Staffing requirement created successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error creating staffing requirement", error)
    return NextResponse.json({ error: "Failed to create staffing requirement" }, { status: 500 })
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
    const requirementId = searchParams.get("id")

    if (!requirementId) {
      return NextResponse.json({ error: "Requirement ID is required" }, { status: 400 })
    }

    // Verify requirement belongs to organization
    const existing = await prisma.staffingRequirement.findFirst({
      where: {
        id: requirementId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Staffing requirement not found" }, { status: 404 })
    }

    const body = await request.json()

    const requirement = await prisma.staffingRequirement.update({
      where: { id: requirementId },
      data: {
        minRequired: body.minRequired,
        idealCount: body.idealCount,
        isActive: body.isActive,
      },
      include: {
        positionCategory: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: requirement,
      message: "Staffing requirement updated successfully",
    })
  } catch (error) {
    logger.error("Error updating staffing requirement", error)
    return NextResponse.json({ error: "Failed to update staffing requirement" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete staffing requirements" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requirementId = searchParams.get("id")

    if (!requirementId) {
      return NextResponse.json({ error: "Requirement ID is required" }, { status: 400 })
    }

    // Verify requirement belongs to organization
    const existing = await prisma.staffingRequirement.findFirst({
      where: {
        id: requirementId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Staffing requirement not found" }, { status: 404 })
    }

    await prisma.staffingRequirement.delete({
      where: { id: requirementId },
    })

    return NextResponse.json({
      success: true,
      message: "Staffing requirement deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting staffing requirement", error)
    return NextResponse.json({ error: "Failed to delete staffing requirement" }, { status: 500 })
  }
}

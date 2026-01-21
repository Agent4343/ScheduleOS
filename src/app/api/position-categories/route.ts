import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const categories = await prisma.positionCategory.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: { users: true, staffingRequirements: true },
        },
        staffingRequirements: {
          where: { isActive: true },
          select: {
            id: true,
            shiftType: true,
            minRequired: true,
            idealCount: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    logger.error("Error fetching position categories", error)
    return NextResponse.json({ error: "Failed to fetch position categories" }, { status: 500 })
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
    const { name, code, description, isOffshore, sortOrder } = body

    if (!name || !code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 })
    }

    // Check for duplicate code
    const existing = await prisma.positionCategory.findFirst({
      where: {
        organizationId: session.user.organizationId,
        code: code.toUpperCase(),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A position category with this code already exists" },
        { status: 400 }
      )
    }

    const category = await prisma.positionCategory.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        isOffshore: isOffshore || false,
        sortOrder: sortOrder || 0,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json(
      { success: true, data: category, message: "Position category created successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error creating position category", error)
    return NextResponse.json({ error: "Failed to create position category" }, { status: 500 })
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
    const categoryId = searchParams.get("id")

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    // Verify category belongs to organization
    const existing = await prisma.positionCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Position category not found" }, { status: 404 })
    }

    const body = await request.json()

    // Check for duplicate code if changing
    if (body.code && body.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.positionCategory.findFirst({
        where: {
          organizationId: session.user.organizationId,
          code: body.code.toUpperCase(),
          id: { not: categoryId },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A position category with this code already exists" },
          { status: 400 }
        )
      }
    }

    const category = await prisma.positionCategory.update({
      where: { id: categoryId },
      data: {
        name: body.name,
        code: body.code?.toUpperCase(),
        description: body.description,
        isOffshore: body.isOffshore,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: "Position category updated successfully",
    })
  } catch (error) {
    logger.error("Error updating position category", error)
    return NextResponse.json({ error: "Failed to update position category" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete position categories" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get("id")

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    // Verify category belongs to organization
    const existing = await prisma.positionCategory.findFirst({
      where: {
        id: categoryId,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: { select: { users: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Position category not found" }, { status: 404 })
    }

    // Check if category is in use
    if (existing._count.users > 0) {
      return NextResponse.json(
        { error: "Cannot delete category that has workers assigned" },
        { status: 400 }
      )
    }

    await prisma.positionCategory.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({
      success: true,
      message: "Position category deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting position category", error)
    return NextResponse.json({ error: "Failed to delete position category" }, { status: 500 })
  }
}

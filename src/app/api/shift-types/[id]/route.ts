import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { name, abbreviation, category, bgColor, textColor, sortOrder, isActive } = body

    // Verify shift type belongs to organization
    const existingShiftType = await prisma.shiftTypeConfig.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingShiftType) {
      return NextResponse.json({ error: "Shift type not found" }, { status: 404 })
    }

    const shiftType = await prisma.shiftTypeConfig.update({
      where: { id: params.id },
      data: {
        name: name ?? existingShiftType.name,
        abbreviation: abbreviation ?? existingShiftType.abbreviation,
        category: category ?? existingShiftType.category,
        bgColor: bgColor ?? existingShiftType.bgColor,
        textColor: textColor ?? existingShiftType.textColor,
        sortOrder: sortOrder ?? existingShiftType.sortOrder,
        isActive: isActive ?? existingShiftType.isActive,
      },
    })

    return NextResponse.json({ success: true, data: shiftType })
  } catch (error) {
    console.error("Error updating shift type:", error)
    return NextResponse.json({ error: "Failed to update shift type" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify shift type belongs to organization
    const existingShiftType = await prisma.shiftTypeConfig.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingShiftType) {
      return NextResponse.json({ error: "Shift type not found" }, { status: 404 })
    }

    // Don't allow deleting system shift types - disable them instead
    if (existingShiftType.isSystem) {
      await prisma.shiftTypeConfig.update({
        where: { id: params.id },
        data: { isActive: false },
      })
      return NextResponse.json({
        success: true,
        message: "System shift type has been disabled (cannot be deleted)"
      })
    }

    await prisma.shiftTypeConfig.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: "Shift type deleted" })
  } catch (error) {
    console.error("Error deleting shift type:", error)
    return NextResponse.json({ error: "Failed to delete shift type" }, { status: 500 })
  }
}

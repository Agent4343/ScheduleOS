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
    const { isDefault, name, daysOn, daysOff, includesNights } = body

    // Verify pattern belongs to organization
    const existingPattern = await prisma.rotationPattern.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    // If setting as default, unset other defaults first
    if (isDefault === true) {
      await prisma.rotationPattern.updateMany({
        where: {
          organizationId: session.user.organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    const pattern = await prisma.rotationPattern.update({
      where: { id: params.id },
      data: {
        isDefault: isDefault ?? existingPattern.isDefault,
        name: name ?? existingPattern.name,
        daysOn: daysOn ?? existingPattern.daysOn,
        daysOff: daysOff ?? existingPattern.daysOff,
        includesNights: includesNights ?? existingPattern.includesNights,
      },
    })

    return NextResponse.json({ success: true, data: pattern })
  } catch (error) {
    console.error("Error updating pattern:", error)
    return NextResponse.json({ error: "Failed to update pattern" }, { status: 500 })
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

    // Verify pattern belongs to organization
    const existingPattern = await prisma.rotationPattern.findFirst({
      where: {
        id: params.id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: { select: { crews: true } },
      },
    })

    if (!existingPattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 })
    }

    // Check if pattern is in use by crews
    if (existingPattern._count.crews > 0) {
      return NextResponse.json(
        { error: `Cannot delete pattern: ${existingPattern._count.crews} crew(s) are using it` },
        { status: 400 }
      )
    }

    await prisma.rotationPattern.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: "Pattern deleted" })
  } catch (error) {
    console.error("Error deleting pattern:", error)
    return NextResponse.json({ error: "Failed to delete pattern" }, { status: 500 })
  }
}

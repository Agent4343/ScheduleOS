import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const position = await prisma.position.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: position })
  } catch (error) {
    console.error("Error fetching position:", error)
    return NextResponse.json({ error: "Failed to fetch position" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify position belongs to organization
    const existingPosition = await prisma.position.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingPosition) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 })
    }

    // Build update data
    const updateData: {
      name?: string
      code?: string | null
      category?: string | null
      shiftType?: string
      minStaffing?: number
      maxStaffing?: number
      requiredQualifications?: string[]
      sortOrder?: number
    } = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.code !== undefined) updateData.code = body.code || null
    if (body.category !== undefined) updateData.category = body.category || null
    if (body.shiftType !== undefined) updateData.shiftType = body.shiftType
    if (body.minStaffing !== undefined) updateData.minStaffing = body.minStaffing
    if (body.maxStaffing !== undefined) updateData.maxStaffing = body.maxStaffing
    if (body.requiredQualifications !== undefined) updateData.requiredQualifications = body.requiredQualifications
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder

    const position = await prisma.position.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, data: position })
  } catch (error) {
    console.error("Error updating position:", error)
    return NextResponse.json({ error: "Failed to update position" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { id } = await params

    // Verify position belongs to organization
    const existingPosition = await prisma.position.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingPosition) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 })
    }

    await prisma.position.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Position deleted" })
  } catch (error) {
    console.error("Error deleting position:", error)
    return NextResponse.json({ error: "Failed to delete position" }, { status: 500 })
  }
}

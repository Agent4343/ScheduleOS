import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

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

    // Verify crew belongs to organization
    const existingCrew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingCrew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    // Build update data
    const updateData: {
      name?: string
      description?: string | null
      color?: string
      rotationPatternId?: string | null
      currentPhase?: number
    } = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.color !== undefined) updateData.color = body.color
    if (body.rotationPatternId !== undefined) updateData.rotationPatternId = body.rotationPatternId
    if (body.currentPhase !== undefined) updateData.currentPhase = body.currentPhase

    const crew = await prisma.crew.update({
      where: { id },
      data: updateData,
      include: {
        rotationPattern: {
          select: {
            id: true,
            name: true,
            daysOn: true,
            daysOff: true,
            includesNights: true,
          },
        },
        _count: {
          select: { workers: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: crew })
  } catch (error) {
    console.error("Error updating crew:", error)
    return NextResponse.json({ error: "Failed to update crew" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
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

    // Verify crew belongs to organization
    const existingCrew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingCrew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    await prisma.crew.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Crew deleted" })
  } catch (error) {
    console.error("Error deleting crew:", error)
    return NextResponse.json({ error: "Failed to delete crew" }, { status: 500 })
  }
}

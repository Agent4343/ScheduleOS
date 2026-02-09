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

    const crew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
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

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: crew })
  } catch (error) {
    console.error("Error fetching crew:", error)
    return NextResponse.json({ error: "Failed to fetch crew" }, { status: 500 })
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

    // Verify crew exists and belongs to organization
    const existingCrew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingCrew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    const body = await request.json()

    // Verify rotation pattern if provided
    if (body.rotationPatternId) {
      const pattern = await prisma.rotationPattern.findFirst({
        where: {
          id: body.rotationPatternId,
          organizationId: session.user.organizationId,
        },
      })

      if (!pattern) {
        return NextResponse.json({ error: "Invalid rotation pattern" }, { status: 400 })
      }
    }

    // Check for duplicate name (excluding current crew)
    if (body.name && body.name !== existingCrew.name) {
      const duplicateCrew = await prisma.crew.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: body.name,
          NOT: { id },
        },
      })

      if (duplicateCrew) {
        return NextResponse.json(
          { error: "A crew with this name already exists" },
          { status: 400 }
        )
      }
    }

    const crew = await prisma.crew.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        color: body.color,
        rotationPatternId: body.rotationPatternId || null,
        currentPhase: body.currentPhase ?? existingCrew.currentPhase,
      },
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
  _request: NextRequest,
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

    // Verify crew exists and belongs to organization
    const existingCrew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: { workers: true },
        },
      },
    })

    if (!existingCrew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    // Warn if crew has workers
    if (existingCrew._count.workers > 0) {
      // Remove crew assignment from workers first
      await prisma.user.updateMany({
        where: { crewId: id },
        data: { crewId: null },
      })
    }

    await prisma.crew.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: "Crew deleted successfully" })
  } catch (error) {
    console.error("Error deleting crew:", error)
    return NextResponse.json({ error: "Failed to delete crew" }, { status: 500 })
  }
}

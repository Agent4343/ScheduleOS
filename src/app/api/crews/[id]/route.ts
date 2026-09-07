import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { updateCrewSchema } from "@/lib/validations"
import { crewPatternSelect, withCurrentPhase } from "@/lib/crew-phase"
import { getTodayUTC } from "@/lib/timezone"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

    const { id } = await params

    const crew = await prisma.crew.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        rotationPattern: { select: crewPatternSelect },
        _count: {
          select: { workers: true },
        },
      },
    })

    if (!crew) {
      return NextResponse.json({ error: "Crew not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: withCurrentPhase(crew) })
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
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

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

    const body = updateCrewSchema.parse(await request.json())

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

    // Only touch fields that were sent. Changing the pattern clears the anchor:
    // the crew is re-anchored by its next schedule generation.
    const patternChanged =
      body.rotationPatternId !== undefined && body.rotationPatternId !== existingCrew.rotationPatternId

    // Editing the phase of an anchored crew means "as of today, the crew is on
    // day N" — so re-anchor at today rather than letting the stored number and
    // the derived one disagree.
    const existingWithPattern = await prisma.crew.findUnique({
      where: { id },
      select: {
        currentPhase: true,
        rotationAnchorDate: true,
        anchorPhase: true,
        anchorStartingShift: true,
        rotationPattern: { select: crewPatternSelect },
      },
    })
    const today = getTodayUTC()
    const derivedPhase = existingWithPattern ? withCurrentPhase(existingWithPattern, today).currentPhase : null
    const reanchor =
      !patternChanged &&
      body.currentPhase !== undefined &&
      existingCrew.rotationAnchorDate !== null &&
      body.currentPhase !== derivedPhase

    const crew = await prisma.crew.update({
      where: { id },
      data: {
        ...(reanchor && { rotationAnchorDate: today, anchorPhase: body.currentPhase }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.rotationPatternId !== undefined && { rotationPatternId: body.rotationPatternId || null }),
        ...(body.currentPhase !== undefined && { currentPhase: body.currentPhase }),
        ...(patternChanged && {
          rotationAnchorDate: null,
          anchorPhase: 0,
          anchorStartingShift: null,
        }),
      },
      include: {
        rotationPattern: { select: crewPatternSelect },
        _count: {
          select: { workers: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: withCurrentPhase(crew) })
  } catch (error) {
    console.error("Error updating crew:", error)
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update crew" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { session } = auth

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

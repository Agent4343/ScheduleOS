import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const updateCertificationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

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

    const certification = await prisma.certificationType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        userCertifications: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { userCertifications: true },
        },
      },
    })

    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: certification })
  } catch (error) {
    console.error("Error fetching certification:", error)
    return NextResponse.json({ error: "Failed to fetch certification" }, { status: 500 })
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

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update certifications" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCertificationSchema.parse(body)

    // Verify certification exists and belongs to organization
    const existing = await prisma.certificationType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    // Check for duplicate name if name is being changed
    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicate = await prisma.certificationType.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: validatedData.name,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A certification with this name already exists" },
          { status: 400 }
        )
      }
    }

    const certification = await prisma.certificationType.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: { userCertifications: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: certification,
      message: "Certification updated successfully",
    })
  } catch (error) {
    console.error("Error updating certification:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to update certification" }, { status: 500 })
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
      return NextResponse.json({ error: "Only admins can delete certifications" }, { status: 403 })
    }

    const { id } = await params

    // Verify certification exists and belongs to organization
    const existing = await prisma.certificationType.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    // Delete the certification (cascade will delete user certifications)
    await prisma.certificationType.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Certification deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting certification:", error)
    return NextResponse.json({ error: "Failed to delete certification" }, { status: 500 })
  }
}

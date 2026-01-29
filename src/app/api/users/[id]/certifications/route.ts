import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const assignCertificationSchema = z.object({
  certificationTypeId: z.string(),
  earnedAt: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
})

const bulkUpdateSchema = z.object({
  certificationIds: z.array(z.string()),
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

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const certifications = await prisma.userCertification.findMany({
      where: { userId: id },
      include: {
        certificationType: true,
      },
      orderBy: { certificationType: { name: "asc" } },
    })

    return NextResponse.json({ success: true, data: certifications })
  } catch (error) {
    console.error("Error fetching user certifications:", error)
    return NextResponse.json({ error: "Failed to fetch certifications" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can assign certifications
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if this is a bulk update (array of certification IDs)
    if (body.certificationIds !== undefined) {
      const validatedData = bulkUpdateSchema.parse(body)

      // Get all certification types for this organization
      const orgCertifications = await prisma.certificationType.findMany({
        where: {
          organizationId: session.user.organizationId,
          isActive: true,
        },
        select: { id: true },
      })

      const validCertIds = new Set(orgCertifications.map(c => c.id))
      const requestedCertIds = validatedData.certificationIds.filter(id => validCertIds.has(id))

      // Get current certifications
      const currentCerts = await prisma.userCertification.findMany({
        where: { userId: id },
        select: { certificationTypeId: true },
      })
      const currentCertIds = new Set(currentCerts.map(c => c.certificationTypeId))

      // Determine what to add and remove
      const toAdd = requestedCertIds.filter(certId => !currentCertIds.has(certId))
      const toRemove = Array.from(currentCertIds).filter(certId => !requestedCertIds.includes(certId))

      // Perform updates in a transaction
      await prisma.$transaction([
        // Remove certifications
        prisma.userCertification.deleteMany({
          where: {
            userId: id,
            certificationTypeId: { in: toRemove },
          },
        }),
        // Add certifications
        ...toAdd.map(certificationTypeId =>
          prisma.userCertification.create({
            data: {
              userId: id,
              certificationTypeId,
            },
          })
        ),
      ])

      // Return updated certifications
      const updatedCerts = await prisma.userCertification.findMany({
        where: { userId: id },
        include: { certificationType: true },
      })

      return NextResponse.json({
        success: true,
        data: updatedCerts,
        message: "Certifications updated successfully",
      })
    }

    // Single certification assignment
    const validatedData = assignCertificationSchema.parse(body)

    // Verify certification type belongs to organization
    const certType = await prisma.certificationType.findFirst({
      where: {
        id: validatedData.certificationTypeId,
        organizationId: session.user.organizationId,
      },
    })

    if (!certType) {
      return NextResponse.json({ error: "Invalid certification type" }, { status: 400 })
    }

    // Check if already assigned
    const existing = await prisma.userCertification.findUnique({
      where: {
        userId_certificationTypeId: {
          userId: id,
          certificationTypeId: validatedData.certificationTypeId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "User already has this certification" },
        { status: 400 }
      )
    }

    const certification = await prisma.userCertification.create({
      data: {
        userId: id,
        certificationTypeId: validatedData.certificationTypeId,
        earnedAt: validatedData.earnedAt ? new Date(validatedData.earnedAt) : new Date(),
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
        notes: validatedData.notes,
      },
      include: {
        certificationType: true,
      },
    })

    return NextResponse.json(
      { success: true, data: certification, message: "Certification assigned successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error assigning certification:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to assign certification" }, { status: 500 })
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

    // Only admins and supervisors can remove certifications
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const certificationTypeId = searchParams.get("certificationTypeId")

    if (!certificationTypeId) {
      return NextResponse.json({ error: "Certification type ID required" }, { status: 400 })
    }

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await prisma.userCertification.delete({
      where: {
        userId_certificationTypeId: {
          userId: id,
          certificationTypeId,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Certification removed successfully",
    })
  } catch (error) {
    console.error("Error removing certification:", error)
    return NextResponse.json({ error: "Failed to remove certification" }, { status: 500 })
  }
}

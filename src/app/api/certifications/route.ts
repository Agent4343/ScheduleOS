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

    const certifications = await prisma.certification.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: {
        _count: {
          select: { userCertifications: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: certifications })
  } catch (error) {
    logger.error("Error fetching certifications", error)
    return NextResponse.json({ error: "Failed to fetch certifications" }, { status: 500 })
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
    const { name, code, description, isRequired, validityDays } = body

    if (!name || !code) {
      return NextResponse.json({ error: "Name and code are required" }, { status: 400 })
    }

    // Check for duplicate code
    const existing = await prisma.certification.findFirst({
      where: {
        organizationId: session.user.organizationId,
        code: code.toUpperCase(),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "A certification with this code already exists" },
        { status: 400 }
      )
    }

    const certification = await prisma.certification.create({
      data: {
        name,
        code: code.toUpperCase(),
        description,
        isRequired: isRequired || false,
        validityDays,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json(
      { success: true, data: certification, message: "Certification created successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error creating certification", error)
    return NextResponse.json({ error: "Failed to create certification" }, { status: 500 })
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
    const certId = searchParams.get("id")

    if (!certId) {
      return NextResponse.json({ error: "Certification ID is required" }, { status: 400 })
    }

    // Verify certification belongs to organization
    const existing = await prisma.certification.findFirst({
      where: {
        id: certId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    const body = await request.json()

    // Check for duplicate code if changing
    if (body.code && body.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.certification.findFirst({
        where: {
          organizationId: session.user.organizationId,
          code: body.code.toUpperCase(),
          id: { not: certId },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "A certification with this code already exists" },
          { status: 400 }
        )
      }
    }

    const certification = await prisma.certification.update({
      where: { id: certId },
      data: {
        name: body.name,
        code: body.code?.toUpperCase(),
        description: body.description,
        isRequired: body.isRequired,
        validityDays: body.validityDays,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({
      success: true,
      data: certification,
      message: "Certification updated successfully",
    })
  } catch (error) {
    logger.error("Error updating certification", error)
    return NextResponse.json({ error: "Failed to update certification" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete certifications" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const certId = searchParams.get("id")

    if (!certId) {
      return NextResponse.json({ error: "Certification ID is required" }, { status: 400 })
    }

    // Verify certification belongs to organization
    const existing = await prisma.certification.findFirst({
      where: {
        id: certId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    // Delete associated user certifications first
    await prisma.userCertification.deleteMany({
      where: { certificationId: certId },
    })

    await prisma.certification.delete({
      where: { id: certId },
    })

    return NextResponse.json({
      success: true,
      message: "Certification deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting certification", error)
    return NextResponse.json({ error: "Failed to delete certification" }, { status: 500 })
  }
}

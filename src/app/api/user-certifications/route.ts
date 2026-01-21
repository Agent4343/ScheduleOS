import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const certificationId = searchParams.get("certificationId")

    const userCertifications = await prisma.userCertification.findMany({
      where: {
        user: { organizationId: session.user.organizationId },
        ...(userId && { userId }),
        ...(certificationId && { certificationId }),
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            positionCategory: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        certification: {
          select: {
            id: true,
            name: true,
            code: true,
            validityDays: true,
          },
        },
      },
      orderBy: [
        { user: { name: "asc" } },
        { certification: { name: "asc" } },
      ],
    })

    // Add expiry status
    const today = new Date()
    const enhancedData = userCertifications.map((uc) => ({
      ...uc,
      isExpired: uc.expiryDate ? new Date(uc.expiryDate) < today : false,
      isExpiringSoon: uc.expiryDate
        ? new Date(uc.expiryDate) < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) &&
          new Date(uc.expiryDate) >= today
        : false,
    }))

    return NextResponse.json({ success: true, data: enhancedData })
  } catch (error) {
    logger.error("Error fetching user certifications", error)
    return NextResponse.json({ error: "Failed to fetch user certifications" }, { status: 500 })
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
    const { userId, certificationId, certifiedDate, expiryDate, notes } = body

    if (!userId || !certificationId || !certifiedDate) {
      return NextResponse.json(
        { error: "User ID, certification ID, and certified date are required" },
        { status: 400 }
      )
    }

    // Verify user belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.user.organizationId,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify certification belongs to organization
    const certification = await prisma.certification.findFirst({
      where: {
        id: certificationId,
        organizationId: session.user.organizationId,
      },
    })

    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 })
    }

    // Check for existing record
    const existing = await prisma.userCertification.findFirst({
      where: {
        userId,
        certificationId,
      },
    })

    if (existing) {
      // Update existing
      const userCert = await prisma.userCertification.update({
        where: { id: existing.id },
        data: {
          certifiedDate: new Date(certifiedDate),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          notes,
          isActive: true,
        },
        include: {
          user: { select: { id: true, name: true } },
          certification: { select: { id: true, name: true, code: true } },
        },
      })

      return NextResponse.json({
        success: true,
        data: userCert,
        message: "User certification updated successfully",
      })
    }

    const userCertification = await prisma.userCertification.create({
      data: {
        userId,
        certificationId,
        certifiedDate: new Date(certifiedDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes,
      },
      include: {
        user: { select: { id: true, name: true } },
        certification: { select: { id: true, name: true, code: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: userCertification, message: "User certification added successfully" },
      { status: 201 }
    )
  } catch (error) {
    logger.error("Error adding user certification", error)
    return NextResponse.json({ error: "Failed to add user certification" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "User certification ID is required" }, { status: 400 })
    }

    // Verify user certification belongs to organization
    const existing = await prisma.userCertification.findFirst({
      where: {
        id,
        user: { organizationId: session.user.organizationId },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "User certification not found" }, { status: 404 })
    }

    await prisma.userCertification.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "User certification removed successfully",
    })
  } catch (error) {
    logger.error("Error removing user certification", error)
    return NextResponse.json({ error: "Failed to remove user certification" }, { status: 500 })
  }
}

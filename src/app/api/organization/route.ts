import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { updateOrganizationSchema } from "@/lib/validations"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        _count: {
          select: {
            users: true,
            crews: true,
            rotationPatterns: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: organization })
  } catch (error) {
    console.error("Error fetching organization:", error)
    return NextResponse.json({ error: "Failed to fetch organization" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can update organization settings" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateOrganizationSchema.parse(body)

    const existingOrganization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    })

    const existingSettings =
      existingOrganization?.settings && typeof existingOrganization.settings === "object"
        ? (existingOrganization.settings as Record<string, unknown>)
        : {}

    const mergedSettings = validatedData.settings
      ? { ...existingSettings, ...validatedData.settings }
      : undefined

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(mergedSettings && { settings: mergedSettings }),
      },
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: "Organization updated successfully",
    })
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}

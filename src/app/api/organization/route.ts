import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { updateOrganizationSchema } from "@/lib/validations"
import { mergeOrganizationSettings } from "@/lib/organization-settings"

export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { session } = auth

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
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await request.json()
    const validatedData = updateOrganizationSchema.parse(body)

    // Settings are a partial update merged over the stored value, so a client
    // that sends only the keys it knows about never erases the rest (billing
    // fields written by the Stripe webhook, shift colours, auto-checkout, ...).
    const organization = await prisma.$transaction(async (tx) => {
      const current = await tx.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { settings: true },
      })
      if (!current) {
        throw new Error("Organization not found")
      }

      return tx.organization.update({
        where: { id: session.user.organizationId },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.settings && {
            settings: mergeOrganizationSettings(current.settings, validatedData.settings),
          }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: organization,
      message: "Organization updated successfully",
    })
  } catch (error) {
    console.error("Error updating organization:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}

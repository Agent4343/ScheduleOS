import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getStripe, getAbsoluteUrl } from "@/lib/stripe"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can manage billing" },
        { status: 403 }
      )
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    })

    if (!organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 404 }
      )
    }

    // Create billing portal session
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: getAbsoluteUrl("/settings"),
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error("Error creating portal session:", error)
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    )
  }
}

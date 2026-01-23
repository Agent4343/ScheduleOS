import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import Stripe from "stripe"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBillingSettings } from "@/lib/billing"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { settings: true },
    })

    const billingSettings = getBillingSettings(organization?.settings)
    if (!billingSettings.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    })

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: billingSettings.stripeCustomerId,
      return_url: `${origin}/billing`,
    })

    return NextResponse.json({ success: true, url: portalSession.url })
  } catch (error) {
    console.error("Billing portal error:", error)
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 })
  }
}

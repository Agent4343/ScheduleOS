import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import Stripe from "stripe"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBillingSettings, updateOrganizationBilling } from "@/lib/billing"

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "enterprise"]),
  quantity: z.number().int().min(1).optional(),
})

const planPriceMap = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can start billing" }, { status: 403 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    const body = await request.json()
    const { plan, quantity } = checkoutSchema.parse(body)

    const priceId = planPriceMap[plan]
    if (!priceId) {
      return NextResponse.json({ error: "Price not configured for this plan" }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, name: true, settings: true },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const billingSettings = getBillingSettings(organization.settings)
    let customerId = billingSettings.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: organization.name,
        email: session.user.email || undefined,
        metadata: {
          organizationId: organization.id,
        },
      })
      customerId = customer.id
      await updateOrganizationBilling(organization.id, { stripeCustomerId: customerId })
    }

    const seatCount =
      quantity ??
      (await prisma.user.count({
        where: {
          organizationId: organization.id,
          status: "ACTIVE",
        },
      }))

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const trialDays = process.env.STRIPE_TRIAL_DAYS ? Number(process.env.STRIPE_TRIAL_DAYS) : undefined

    const sessionResponse = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: seatCount,
        },
      ],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          plan,
        },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      client_reference_id: organization.id,
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
    })

    await updateOrganizationBilling(organization.id, {
      requestedPlan: plan,
      seatCount,
    })

    return NextResponse.json({ success: true, url: sessionResponse.url })
  } catch (error) {
    console.error("Billing checkout error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 })
  }
}

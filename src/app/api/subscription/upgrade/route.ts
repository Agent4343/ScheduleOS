import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { SUBSCRIPTION_TIERS, SubscriptionTierKey } from "@/lib/subscription"
import { z } from "zod"

const upgradeSchema = z.object({
  tier: z.enum(["STARTER", "GROWTH", "PRO", "BUSINESS"]),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can upgrade
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can manage subscriptions" }, { status: 403 })
    }

    const body = await request.json()
    const { tier: targetTier } = upgradeSchema.parse(body)

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        subscriptionTier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const currentTier = organization.subscriptionTier as SubscriptionTierKey
    const tierOrder = ["TRIAL", "STARTER", "GROWTH", "PRO", "BUSINESS"]
    const currentIndex = tierOrder.indexOf(currentTier)
    const targetIndex = tierOrder.indexOf(targetTier)

    // Prevent downgrades through this endpoint
    if (targetIndex <= currentIndex) {
      return NextResponse.json(
        { error: "Cannot downgrade through this endpoint. Please contact support." },
        { status: 400 }
      )
    }

    const targetTierInfo = SUBSCRIPTION_TIERS[targetTier]

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const priceId = targetTierInfo.priceId

    if (stripeSecretKey && priceId) {
      // Stripe is configured - create checkout session
      const Stripe = (await import("stripe")).default
      const stripe = new Stripe(stripeSecretKey)

      // Create or get customer
      let customerId = organization.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: session.user.email || undefined,
          metadata: {
            organizationId: organization.id,
          },
        })
        customerId = customer.id

        await prisma.organization.update({
          where: { id: organization.id },
          data: { stripeCustomerId: customerId },
        })
      }

      // Create checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXTAUTH_URL}/settings?upgrade=success`,
        cancel_url: `${process.env.NEXTAUTH_URL}/pricing?upgrade=cancelled`,
        metadata: {
          organizationId: organization.id,
          targetTier,
        },
      })

      return NextResponse.json({ checkoutUrl: checkoutSession.url })
    } else {
      // Stripe not configured - upgrade directly (for development/demo)
      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          subscriptionTier: targetTier,
          subscriptionStatus: "ACTIVE",
          workerLimit: targetTierInfo.workerLimit,
          trialEndsAt: null,
        },
      })

      return NextResponse.json({
        success: true,
        message: `Successfully upgraded to ${targetTierInfo.name}`,
        tier: targetTier,
      })
    }
  } catch (error) {
    console.error("Error processing upgrade:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid tier specified" }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to process upgrade" }, { status: 500 })
  }
}

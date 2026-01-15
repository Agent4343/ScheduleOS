import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getStripe, getAbsoluteUrl } from "@/lib/stripe"

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { priceId, plan } = body

    if (!priceId || !plan) {
      return NextResponse.json(
        { error: "Price ID and plan are required" },
        { status: 400 }
      )
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
    })

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Create or get Stripe customer
    let customerId = organization.stripeCustomerId

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: session.user.email!,
        name: organization.name,
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
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: getAbsoluteUrl(
        `/settings?success=true&plan=${plan}`
      ),
      cancel_url: getAbsoluteUrl("/settings/billing?canceled=true"),
      metadata: {
        organizationId: organization.id,
        plan,
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}

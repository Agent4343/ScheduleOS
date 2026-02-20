import { NextRequest, NextResponse } from "next/server"
import { getStripe, PLANS, PlanKey } from "@/lib/stripe"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan, email, organizationName } = body

    if (!plan || !PLANS[plan as PlanKey]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const selectedPlan = PLANS[plan as PlanKey]

    if (!selectedPlan.priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for this plan" },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://scheduleos-production.up.railway.app"

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan,
          organizationName: organizationName || "",
        },
      },
      metadata: {
        plan,
        organizationName: organizationName || "",
      },
      success_url: `${baseUrl}/register?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}

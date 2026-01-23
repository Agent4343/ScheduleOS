import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { updateOrganizationBilling } from "@/lib/billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getPlanFromPrice(priceId?: string | null) {
  if (!priceId) return undefined
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter"
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro"
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise"
  return undefined
}

export async function POST(request: Request) {
  const signature = headers().get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 })
  }

  const body = await request.text()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const organizationId =
          (session.metadata?.organizationId as string | undefined) ||
          (session.client_reference_id as string | undefined)
        const subscriptionId = session.subscription as string | null
        const customerId = session.customer as string | null

        if (organizationId) {
          await updateOrganizationBilling(organizationId, {
            stripeCustomerId: customerId || undefined,
            stripeSubscriptionId: subscriptionId || undefined,
            status: "active",
            plan: session.metadata?.plan,
          })
        }
        break
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata?.organizationId as string | undefined
        const plan = getPlanFromPrice(subscription.items.data[0]?.price?.id)

        if (organizationId) {
          await updateOrganizationBilling(organizationId, {
            plan,
            status: subscription.status,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : undefined,
            trialEndsAt: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : undefined,
            seatCount: subscription.items.data[0]?.quantity || undefined,
          })
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook handler error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

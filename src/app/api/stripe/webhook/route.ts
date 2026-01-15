import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { PlanType, SubscriptionStatus } from "@prisma/client"

// Disable body parsing, we need raw body for webhook verification
export const dynamic = "force-dynamic"

// Map Stripe status to our enum
function mapStripeStatus(status: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
    past_due: "PAST_DUE",
    trialing: "TRIALING",
    unpaid: "UNPAID",
  }
  return statusMap[status] || "INCOMPLETE"
}

// Map plan string to PlanType enum
function mapPlanType(plan: string): PlanType {
  const planMap: Record<string, PlanType> = {
    PRO: "PRO",
    ENTERPRISE: "ENTERPRISE",
  }
  return planMap[plan] || "FREE"
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === "subscription" && session.subscription) {
          const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )

          const organizationId = session.metadata?.organizationId
          const plan = session.metadata?.plan || "PRO"

          if (organizationId) {
            // Create or update subscription record
            await prisma.subscription.upsert({
              where: { organizationId },
              create: {
                organizationId,
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0].price.id,
                stripeCustomerId: subscription.customer as string,
                status: mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(
                  subscription.current_period_start * 1000
                ),
                currentPeriodEnd: new Date(
                  subscription.current_period_end * 1000
                ),
              },
              update: {
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0].price.id,
                status: mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(
                  subscription.current_period_start * 1000
                ),
                currentPeriodEnd: new Date(
                  subscription.current_period_end * 1000
                ),
              },
            })

            // Update organization plan
            await prisma.organization.update({
              where: { id: organizationId },
              data: {
                plan: mapPlanType(plan),
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0].price.id,
                planPeriodEnd: new Date(
                  subscription.current_period_end * 1000
                ),
              },
            })
          }
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata?.organizationId

        if (organizationId) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: mapStripeStatus(subscription.status),
              stripePriceId: subscription.items.data[0].price.id,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
          })

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              planPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const organizationId = subscription.metadata?.organizationId

        if (organizationId) {
          // Update subscription status
          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status: "CANCELED",
              canceledAt: new Date(),
            },
          })

          // Downgrade organization to free plan
          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              plan: "FREE",
              stripeSubscriptionId: null,
              stripePriceId: null,
              planPeriodEnd: null,
            },
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId },
          })

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: "PAST_DUE" },
            })
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}

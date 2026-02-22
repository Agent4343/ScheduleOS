import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const plan = session.metadata?.plan || "starter"
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id

        // Store plan info on the organization if we can match by email
        if (session.customer_email) {
          const user = await prisma.user.findUnique({
            where: { email: session.customer_email },
          })

          if (user?.organizationId) {
            await prisma.organization.update({
              where: { id: user.organizationId },
              data: {
                settings: {
                  plan,
                  stripeCustomerId: session.customer as string,
                  stripeSubscriptionId: subscriptionId,
                  subscriptionStatus: "trialing",
                },
              },
            })
          }
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const status = subscription.status
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id

        // Find org by stripe customer ID and update status
        const orgs = await prisma.organization.findMany({
          where: {
            settings: {
              path: ["stripeCustomerId"],
              equals: customerId,
            },
          },
        })

        for (const org of orgs) {
          const currentSettings =
            (org.settings as Record<string, unknown>) || {}
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              settings: {
                ...currentSettings,
                subscriptionStatus: status,
              },
            },
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id

        const orgs = await prisma.organization.findMany({
          where: {
            settings: {
              path: ["stripeCustomerId"],
              equals: customerId,
            },
          },
        })

        for (const org of orgs) {
          const currentSettings =
            (org.settings as Record<string, unknown>) || {}
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              settings: {
                ...currentSettings,
                subscriptionStatus: "canceled",
              },
            },
          })
        }
        break
      }
    }
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, CreditCard, Zap } from "lucide-react"

const PLANS = {
  FREE: {
    name: "Free",
    description: "For small teams getting started",
    price: 0,
    priceId: null,
    features: [
      "Up to 10 workers",
      "2 crews/rotation groups",
      "30-day schedule history",
      "Basic reporting",
      "Community support",
    ],
  },
  PRO: {
    name: "Pro",
    description: "For growing operations",
    price: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    popular: true,
    features: [
      "Up to 50 workers",
      "10 crews/rotation groups",
      "1-year schedule history",
      "Advanced reporting",
      "Email notifications",
      "Priority email support",
      "Export to PDF/Excel",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "For large-scale operations",
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      "Unlimited workers",
      "Unlimited crews/rotation groups",
      "Unlimited schedule history",
      "Custom reporting",
      "Email & SMS notifications",
      "API access",
      "SSO (SAML/OAuth)",
      "Dedicated support",
      "Custom branding",
    ],
  },
}

type PlanKey = keyof typeof PLANS

export default function BillingPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = (session?.user as { plan?: string })?.plan || "FREE"
  const isAdmin = session?.user?.role === "ADMIN"

  async function handleSubscribe(plan: PlanKey) {
    if (!isAdmin) return

    const planData = PLANS[plan]
    if (!planData.priceId) return

    setLoading(plan)

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: planData.priceId,
          plan,
        }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("No checkout URL returned")
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
    } finally {
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    if (!isAdmin) return

    setPortalLoading(true)

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error("Error opening billing portal:", error)
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current Plan Banner */}
      <Card className="border-primary">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Current Plan: {PLANS[currentPlan as PlanKey]?.name || "Free"}</p>
              <p className="text-sm text-muted-foreground">
                {currentPlan === "FREE"
                  ? "Upgrade to unlock more features"
                  : "Your subscription is active"}
              </p>
            </div>
          </div>
          {currentPlan !== "FREE" && isAdmin && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Manage Billing"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {(Object.entries(PLANS) as [PlanKey, typeof PLANS.FREE & { popular?: boolean }][]).map(
          ([key, plan]) => (
            <Card
              key={key}
              className={`relative ${
                plan.popular ? "border-primary shadow-lg" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">
                    <Zap className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {currentPlan === key && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isAdmin ? (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    disabled={
                      currentPlan === key ||
                      loading === key ||
                      !plan.priceId
                    }
                    onClick={() => handleSubscribe(key)}
                  >
                    {loading === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentPlan === key ? (
                      "Current Plan"
                    ) : key === "FREE" ? (
                      "Free Forever"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Contact your admin to change plans
                  </p>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* FAQ or Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">Can I cancel anytime?</h4>
            <p className="text-sm text-muted-foreground">
              Yes, you can cancel your subscription at any time. You&apos;ll
              continue to have access until the end of your billing period.
            </p>
          </div>
          <div>
            <h4 className="font-medium">What payment methods do you accept?</h4>
            <p className="text-sm text-muted-foreground">
              We accept all major credit cards including Visa, Mastercard,
              American Express, and Discover.
            </p>
          </div>
          <div>
            <h4 className="font-medium">Do you offer refunds?</h4>
            <p className="text-sm text-muted-foreground">
              We offer a 14-day money-back guarantee. If you&apos;re not
              satisfied, contact our support team for a full refund.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

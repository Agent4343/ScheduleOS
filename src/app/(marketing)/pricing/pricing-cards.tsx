"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 29,
    description: "For small teams getting started",
    features: [
      "Up to 15 workers",
      "2 crews",
      "Basic rotation patterns",
      "Email support",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    price: 49,
    description: "For growing offshore operations",
    popular: true,
    features: [
      "Up to 50 workers",
      "Unlimited crews",
      "Custom rotation patterns",
      "AI scheduling assistant",
      "Shift swap management",
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "For large-scale operations",
    features: [
      "Unlimited workers",
      "Unlimited crews",
      "Custom shift types",
      "Audit logging",
      "API access",
      "Dedicated support",
      "SSO / SAML",
    ],
  },
]

export function PricingCards() {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  function selectPlan(planKey: string) {
    setLoadingPlan(planKey)
    router.push(`/register?plan=${planKey}`)
  }

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.key}
          className={`relative rounded-2xl border bg-card p-8 shadow-sm flex flex-col ${
            plan.popular
              ? "border-primary ring-2 ring-primary"
              : "border-border"
          }`}
        >
          {plan.popular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
                Most Popular
              </span>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {plan.description}
            </p>
          </div>

          <div className="mb-6">
            <span className="text-4xl font-bold">${plan.price}</span>
            <span className="text-muted-foreground">/mo</span>
          </div>

          <ul className="mb-8 space-y-3 flex-1">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={() => selectPlan(plan.key)}
            disabled={loadingPlan !== null}
            variant={plan.popular ? "default" : "outline"}
            className="w-full"
            size="lg"
          >
            {loadingPlan === plan.key ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Start free trial
          </Button>
        </div>
      ))}
    </div>
  )
}

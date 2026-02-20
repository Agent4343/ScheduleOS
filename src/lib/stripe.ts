import Stripe from "stripe"

// Lazy-init: only created when actually called, not at import time.
// This avoids build failures when STRIPE_SECRET_KEY is not set.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set")
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    })
  }
  return _stripe
}

export const PLANS = {
  starter: {
    name: "Starter",
    description: "For small teams getting started",
    price: 49,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    features: [
      "Up to 25 workers",
      "Basic rotation patterns",
      "Time-off management",
      "Email support",
    ],
    limits: { maxWorkers: 25, maxCrews: 4 },
  },
  professional: {
    name: "Professional",
    description: "For growing operations",
    price: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "Up to 100 workers",
      "Custom rotation patterns",
      "AI scheduling assistant",
      "Advanced reporting",
      "Certification tracking",
      "Priority support",
    ],
    limits: { maxWorkers: 100, maxCrews: 999 },
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    description: "For large-scale operations",
    price: 0,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited workers",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "SSO / SAML",
      "SLA guarantee",
    ],
    limits: { maxWorkers: 999999, maxCrews: 999 },
  },
} as const

export type PlanKey = keyof typeof PLANS

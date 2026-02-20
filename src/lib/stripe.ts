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
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    features: [
      "Up to 15 workers",
      "2 crews",
      "Basic rotation patterns",
      "Email support",
    ],
    limits: { maxWorkers: 15, maxCrews: 2 },
  },
  professional: {
    name: "Professional",
    description: "For growing offshore operations",
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "Up to 50 workers",
      "Unlimited crews",
      "Custom rotation patterns",
      "AI scheduling assistant",
      "Shift swap management",
      "Priority support",
    ],
    limits: { maxWorkers: 50, maxCrews: 999 },
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    description: "For large-scale operations",
    price: 99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited workers",
      "Unlimited crews",
      "Custom shift types",
      "Audit logging",
      "API access",
      "Dedicated support",
      "SSO / SAML",
    ],
    limits: { maxWorkers: 999999, maxCrews: 999 },
  },
} as const

export type PlanKey = keyof typeof PLANS

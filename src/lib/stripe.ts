import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
})

// Pricing plans configuration
export const PLANS = {
  FREE: {
    name: "Free",
    description: "For small teams getting started",
    price: 0,
    priceId: null, // No Stripe price for free
    features: [
      "Up to 10 workers",
      "2 crews/rotation groups",
      "30-day schedule history",
      "Basic reporting",
      "Community support",
    ],
    limits: {
      maxWorkers: 10,
      maxCrews: 2,
      scheduleHistoryDays: 30,
      hasAdvancedReports: false,
      hasEmailNotifications: false,
      hasApiAccess: false,
      hasSso: false,
    },
  },
  PRO: {
    name: "Pro",
    description: "For growing operations",
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Up to 50 workers",
      "10 crews/rotation groups",
      "1-year schedule history",
      "Advanced reporting",
      "Email notifications",
      "Priority email support",
      "Export to PDF/Excel",
    ],
    limits: {
      maxWorkers: 50,
      maxCrews: 10,
      scheduleHistoryDays: 365,
      hasAdvancedReports: true,
      hasEmailNotifications: true,
      hasApiAccess: false,
      hasSso: false,
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "For large-scale operations",
    price: 99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
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
    limits: {
      maxWorkers: Infinity,
      maxCrews: Infinity,
      scheduleHistoryDays: Infinity,
      hasAdvancedReports: true,
      hasEmailNotifications: true,
      hasApiAccess: true,
      hasSso: true,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS

// Helper to get plan limits
export function getPlanLimits(plan: PlanKey) {
  return PLANS[plan].limits
}

// Check if organization is within plan limits
export function checkPlanLimit(
  plan: PlanKey,
  limitType: keyof typeof PLANS.FREE.limits,
  currentCount: number
): { allowed: boolean; limit: number | boolean; current: number } {
  const limits = getPlanLimits(plan)
  const limit = limits[limitType]

  if (typeof limit === "boolean") {
    return { allowed: limit, limit, current: currentCount }
  }

  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
  }
}

// Get the absolute URL for Stripe redirects
export function getAbsoluteUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${baseUrl}${path}`
}

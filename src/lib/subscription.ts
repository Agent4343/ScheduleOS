// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
  TRIAL: {
    name: "Trial",
    workerLimit: 5,
    price: 0,
    priceId: null, // No Stripe price for trial
    features: [
      "Up to 5 workers",
      "7-day free trial",
      "All core features",
      "AI scheduling assistant",
    ],
  },
  STARTER: {
    name: "Starter",
    workerLimit: 15,
    price: 39,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      "Up to 15 workers",
      "All core features",
      "AI scheduling assistant",
      "Email support",
      "Custom certifications",
    ],
  },
  GROWTH: {
    name: "Growth",
    workerLimit: 40,
    price: 79,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID,
    features: [
      "Up to 40 workers",
      "Everything in Starter",
      "Priority support",
      "Custom roles",
      "Advanced reports",
    ],
  },
  PRO: {
    name: "Pro",
    workerLimit: 100,
    price: 149,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Up to 100 workers",
      "Everything in Growth",
      "Multiple departments",
      "API access",
      "Phone support",
    ],
  },
  BUSINESS: {
    name: "Business",
    workerLimit: 999999, // Effectively unlimited
    price: 299,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    features: [
      "Unlimited workers",
      "Everything in Pro",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
} as const

export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS

export function getWorkerLimit(tier: SubscriptionTierKey): number {
  return SUBSCRIPTION_TIERS[tier].workerLimit
}

export function getTierPrice(tier: SubscriptionTierKey): number {
  return SUBSCRIPTION_TIERS[tier].price
}

export function getNextTier(currentTier: SubscriptionTierKey): SubscriptionTierKey | null {
  const tiers: SubscriptionTierKey[] = ["TRIAL", "STARTER", "GROWTH", "PRO", "BUSINESS"]
  const currentIndex = tiers.indexOf(currentTier)
  if (currentIndex < tiers.length - 1) {
    return tiers[currentIndex + 1]
  }
  return null
}

export function canAddWorker(currentWorkerCount: number, tier: SubscriptionTierKey): boolean {
  return currentWorkerCount < SUBSCRIPTION_TIERS[tier].workerLimit
}

export function getUpgradeMessage(currentTier: SubscriptionTierKey, currentWorkerCount: number): string | null {
  const limit = SUBSCRIPTION_TIERS[currentTier].workerLimit
  const nextTier = getNextTier(currentTier)

  if (currentWorkerCount >= limit && nextTier) {
    const nextTierInfo = SUBSCRIPTION_TIERS[nextTier]
    return `You've reached your ${limit} worker limit. Upgrade to ${nextTierInfo.name} ($${nextTierInfo.price}/mo) for up to ${nextTierInfo.workerLimit} workers.`
  }

  // Warning when approaching limit (80%)
  if (currentWorkerCount >= limit * 0.8 && nextTier) {
    const remaining = limit - currentWorkerCount
    return `You have ${remaining} worker slot${remaining !== 1 ? 's' : ''} remaining on your current plan.`
  }

  return null
}

export function isTrialExpired(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false
  return new Date() > new Date(trialEndsAt)
}

export function getDaysRemaining(endDate: Date | null): number {
  if (!endDate) return 0
  const now = new Date()
  const end = new Date(endDate)
  const diff = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// Check if a user is the first admin (organization creator) of their organization
// The first admin has unlimited access to bypass subscription limits
export async function isFirstAdmin(
  userId: string,
  organizationId: string
): Promise<boolean> {
  // Dynamic import to avoid circular dependencies
  const { prisma } = await import("@/lib/prisma")

  const firstAdmin = await prisma.user.findFirst({
    where: {
      organizationId,
      role: "ADMIN",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  })

  return firstAdmin?.id === userId
}

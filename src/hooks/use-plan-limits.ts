"use client"

import { useSession } from "next-auth/react"
import { PLANS, PlanKey } from "@/lib/stripe"

export function usePlanLimits() {
  const { data: session } = useSession()

  // Get current plan from session or default to FREE
  const currentPlan = ((session?.user as { plan?: string })?.plan || "FREE") as PlanKey
  const planData = PLANS[currentPlan]

  // Check if a specific limit allows more items
  function canAdd(limitType: keyof typeof PLANS.FREE.limits, currentCount: number): boolean {
    const limit = planData.limits[limitType]
    if (typeof limit === "boolean") return limit
    return currentCount < limit
  }

  // Check if a feature is enabled
  function hasFeature(feature: keyof typeof PLANS.FREE.limits): boolean {
    const value = planData.limits[feature]
    if (typeof value === "boolean") return value
    return value > 0
  }

  // Get the limit value for a specific limit type
  function getLimit(limitType: keyof typeof PLANS.FREE.limits): number | boolean {
    return planData.limits[limitType]
  }

  // Check if user needs to upgrade for a feature
  function needsUpgrade(limitType: keyof typeof PLANS.FREE.limits, currentCount?: number): boolean {
    const limit = planData.limits[limitType]
    if (typeof limit === "boolean") return !limit
    if (currentCount !== undefined) return currentCount >= limit
    return false
  }

  return {
    currentPlan,
    planName: planData.name,
    limits: planData.limits,
    canAdd,
    hasFeature,
    getLimit,
    needsUpgrade,
    isFreePlan: currentPlan === "FREE",
    isProPlan: currentPlan === "PRO",
    isEnterprisePlan: currentPlan === "ENTERPRISE",
  }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { SUBSCRIPTION_TIERS, SubscriptionTierKey, getDaysRemaining, isTrialExpired } from "@/lib/subscription"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        workerLimit: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        _count: {
          select: { users: true },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const tier = organization.subscriptionTier as SubscriptionTierKey
    const tierInfo = SUBSCRIPTION_TIERS[tier]
    const trialExpired = tier === "TRIAL" && isTrialExpired(organization.trialEndsAt)

    return NextResponse.json({
      tier,
      tierName: tierInfo.name,
      workerLimit: organization.workerLimit,
      currentWorkerCount: organization._count.users,
      price: tierInfo.price,
      features: tierInfo.features,
      subscriptionStatus: organization.subscriptionStatus,
      isTrialExpired: trialExpired,
      trialDaysRemaining: tier === "TRIAL" && organization.trialEndsAt
        ? getDaysRemaining(organization.trialEndsAt)
        : null,
      subscriptionEndsAt: organization.subscriptionEndsAt,
    })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}

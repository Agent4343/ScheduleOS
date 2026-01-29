import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { SUBSCRIPTION_TIERS, getDaysRemaining, isTrialExpired } from "@/lib/subscription"

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
          select: {
            users: {
              where: {
                role: "WORKER",
                status: { in: ["ACTIVE", "INACTIVE", "ON_LEAVE"] },
              },
            },
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const tier = organization.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS
    const tierInfo = SUBSCRIPTION_TIERS[tier]
    const workerCount = organization._count.users
    const trialExpired = tier === "TRIAL" && isTrialExpired(organization.trialEndsAt)

    return NextResponse.json({
      success: true,
      data: {
        tier: organization.subscriptionTier,
        status: trialExpired ? "EXPIRED" : organization.subscriptionStatus,
        tierName: tierInfo.name,
        price: tierInfo.price,
        workerLimit: organization.workerLimit,
        workerCount,
        workersRemaining: Math.max(0, organization.workerLimit - workerCount),
        trialEndsAt: organization.trialEndsAt,
        trialDaysRemaining: tier === "TRIAL" ? getDaysRemaining(organization.trialEndsAt) : null,
        subscriptionEndsAt: organization.subscriptionEndsAt,
        features: tierInfo.features,
        canAddWorkers: workerCount < organization.workerLimit && !trialExpired,
        isAtLimit: workerCount >= organization.workerLimit,
        isTrialExpired: trialExpired,
      },
    })
  } catch (error) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
  }
}

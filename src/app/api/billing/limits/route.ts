import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PLANS, PlanKey } from "@/lib/stripe"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const plan = (session.user.plan || "FREE") as PlanKey
    const planLimits = PLANS[plan].limits

    // Get current usage
    const [workerCount, crewCount] = await Promise.all([
      prisma.user.count({
        where: { organizationId, role: "WORKER" },
      }),
      prisma.crew.count({
        where: { organizationId },
      }),
    ])

    return NextResponse.json({
      plan,
      planName: PLANS[plan].name,
      limits: planLimits,
      usage: {
        workers: workerCount,
        crews: crewCount,
      },
      canAddWorker: workerCount < planLimits.maxWorkers,
      canAddCrew: crewCount < planLimits.maxCrews,
    })
  } catch (error) {
    console.error("Error fetching plan limits:", error)
    return NextResponse.json(
      { error: "Failed to fetch plan limits" },
      { status: 500 }
    )
  }
}

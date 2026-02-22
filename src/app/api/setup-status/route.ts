import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

// GET /api/setup-status - Check what setup steps are complete
export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const orgId = auth.session.user.organizationId

    const [crewCount, workerCount, patternCount, scheduleCount] = await Promise.all([
      prisma.crew.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, role: { not: "ADMIN" } } }),
      prisma.rotationPattern.count({ where: { organizationId: orgId } }),
      prisma.schedule.count({ where: { user: { organizationId: orgId } }, take: 1 }),
    ])

    const steps = {
      hasCrews: crewCount > 0,
      hasWorkers: workerCount > 0,
      hasPatterns: patternCount > 0,
      hasSchedules: scheduleCount > 0,
      crewCount,
      workerCount,
      patternCount,
    }

    const completedSteps = [steps.hasCrews, steps.hasWorkers, steps.hasPatterns, steps.hasSchedules].filter(Boolean).length
    const isComplete = completedSteps === 4

    return NextResponse.json({
      success: true,
      data: { ...steps, completedSteps, totalSteps: 4, isComplete },
    })
  } catch (error) {
    console.error("Error checking setup status:", error)
    return NextResponse.json({ error: "Failed to check setup status" }, { status: 500 })
  }
}

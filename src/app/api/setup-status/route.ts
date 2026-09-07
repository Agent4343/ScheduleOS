import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

/**
 * What is set up so far, for the Getting Started checklist.
 *
 * Counts rather than booleans where the number is worth showing, and it
 * covers the coverage model too — a checklist that stops at "generate a
 * schedule" leaves someone with the newer half of the app undiscovered.
 */
export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const orgId = auth.session.user.organizationId

    const [
      crewCount, workerCount, patternCount, scheduleCount,
      coverageRoleCount, positionGroupCount, qualificationCount,
      groupedWorkerCount, signedOffWorkerCount,
    ] = await Promise.all([
      prisma.crew.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, role: { not: "ADMIN" } } }),
      prisma.rotationPattern.count({ where: { organizationId: orgId } }),
      prisma.schedule.count({ where: { user: { organizationId: orgId } } }),
      prisma.coverageRole.count({ where: { organizationId: orgId } }),
      prisma.positionGroup.count({ where: { organizationId: orgId } }),
      prisma.qualification.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, positionGroupId: { not: null } } }),
      prisma.user.count({ where: { organizationId: orgId, qualifications: { isEmpty: false } } }),
    ])

    const steps = {
      hasWorkers: workerCount > 0,
      hasCoverage: coverageRoleCount > 0 && positionGroupCount > 0,
      hasGroupedWorkers: groupedWorkerCount > 0,
      hasSignOffs: qualificationCount > 0 && signedOffWorkerCount > 0,
      hasSchedules: scheduleCount > 0,
      // Kept for anything still reading the old shape
      hasCrews: crewCount > 0,
      hasPatterns: patternCount > 0,
      crewCount,
      workerCount,
      patternCount,
      scheduleCount,
      coverageRoleCount,
      positionGroupCount,
      qualificationCount,
      groupedWorkerCount,
      signedOffWorkerCount,
    }

    const checklist = [steps.hasWorkers, steps.hasCoverage, steps.hasGroupedWorkers, steps.hasSignOffs, steps.hasSchedules]
    const completedSteps = checklist.filter(Boolean).length

    return NextResponse.json({
      success: true,
      data: { ...steps, completedSteps, totalSteps: checklist.length, isComplete: completedSteps === checklist.length },
    })
  } catch (error) {
    console.error("Error checking setup status:", error)
    return NextResponse.json({ error: "Failed to check setup status" }, { status: 500 })
  }
}

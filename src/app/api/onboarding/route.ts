import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Fetch onboarding state and progress
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        onboardingProgress: true,
        organizationId: true,
      },
    })

    if (!user || !user.organizationId) {
      return NextResponse.json({ success: false, error: "User or organization not found" }, { status: 404 })
    }

    // Get organization stats to determine checklist completion
    const [workersCount, crewsCount, schedulesCount, patternsCount] = await Promise.all([
      prisma.user.count({
        where: { organizationId: user.organizationId, role: "WORKER" },
      }),
      prisma.crew.count({
        where: { organizationId: user.organizationId },
      }),
      prisma.schedule.count({
        where: {
          user: { organizationId: user.organizationId },
        },
      }),
      prisma.rotationPattern.count({
        where: { organizationId: user.organizationId },
      }),
    ])

    // Calculate checklist items completion based on actual data
    const checklist = {
      addWorkers: workersCount > 0,
      createCrews: crewsCount > 0,
      setupPatterns: patternsCount > 0,
      generateSchedules: schedulesCount > 0,
    }

    const completedSteps = Object.values(checklist).filter(Boolean).length
    const totalSteps = Object.keys(checklist).length
    const isOnboardingComplete = completedSteps === totalSteps

    return NextResponse.json({
      success: true,
      data: {
        hasSeenWelcome: user.hasSeenWelcome,
        hasCompletedTour: user.hasCompletedTour,
        onboardingProgress: user.onboardingProgress,
        checklist,
        completedSteps,
        totalSteps,
        isOnboardingComplete,
        stats: {
          workers: workersCount,
          crews: crewsCount,
          schedules: schedulesCount,
          patterns: patternsCount,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching onboarding state:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch onboarding state" }, { status: 500 })
  }
}

// PATCH - Update onboarding state
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { hasSeenWelcome, hasCompletedTour, onboardingProgress } = body

    const updateData: {
      hasSeenWelcome?: boolean
      hasCompletedTour?: boolean
      onboardingProgress?: object
    } = {}

    if (typeof hasSeenWelcome === "boolean") {
      updateData.hasSeenWelcome = hasSeenWelcome
    }

    if (typeof hasCompletedTour === "boolean") {
      updateData.hasCompletedTour = hasCompletedTour
    }

    if (onboardingProgress && typeof onboardingProgress === "object") {
      // Merge with existing progress
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { onboardingProgress: true },
      })

      const existingProgress = (user?.onboardingProgress as object) || {}
      updateData.onboardingProgress = { ...existingProgress, ...onboardingProgress }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        onboardingProgress: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error("Error updating onboarding state:", error)
    return NextResponse.json({ success: false, error: "Failed to update onboarding state" }, { status: 500 })
  }
}

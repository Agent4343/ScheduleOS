import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions, hashPassword } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations"
import { SUBSCRIPTION_TIERS, isTrialExpired, isFirstAdmin } from "@/lib/subscription"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const crewId = searchParams.get("crewId")
    const departmentId = searchParams.get("departmentId")
    const status = searchParams.get("status")
    const role = searchParams.get("role")

    const whereClause = {
      organizationId: session.user.organizationId,
      ...(crewId && { crewId }),
      ...(departmentId && { departmentId }),
      ...(status && { status: status as "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED" }),
      ...(role && { role: role as "ADMIN" | "SUPERVISOR" | "WORKER" }),
    }

    // Try with customRole first, fall back without it if database hasn't been migrated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let users: any[]
    try {
      users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
          phone: true,
          status: true,
          hireDate: true,
          createdAt: true,
          sortOrder: true,
          isControlRoomTrained: true,
          isOilOperatorTrained: true,
          isUtilityOperatorTrained: true,
          isGasOperatorTrained: true,
          includeInStaffingCount: true,
          singleTrainingCoverageOnly: true,
          customRoleId: true,
          crew: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          customRole: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    } catch {
      // Fallback: query without customRole if table doesn't exist yet
      users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          position: true,
          positionType: true,
          phone: true,
          status: true,
          hireDate: true,
          createdAt: true,
          sortOrder: true,
          isControlRoomTrained: true,
          isOilOperatorTrained: true,
          isUtilityOperatorTrained: true,
          isGasOperatorTrained: true,
          includeInStaffingCount: true,
          singleTrainingCoverageOnly: true,
          crew: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
      // Add null customRole and department to each user for consistent response shape
      users = users.map((u: typeof users[number]) => ({ ...u, customRoleId: null, customRole: null, department: null }))
    }

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can create users
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check subscription limits
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        workerLimit: true,
        trialEndsAt: true,
        _count: {
          select: {
            users: {
              where: {
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

    // First admin (organization creator) bypasses all subscription limits
    const hasUnlimitedAccess = await isFirstAdmin(session.user.id, session.user.organizationId, prisma)

    if (!hasUnlimitedAccess) {
      // Check if trial has expired
      const tier = organization.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS
      if (tier === "TRIAL" && isTrialExpired(organization.trialEndsAt)) {
        return NextResponse.json(
          {
            error: "Trial expired",
            code: "TRIAL_EXPIRED",
            message: "Your free trial has expired. Please upgrade to continue adding workers."
          },
          { status: 402 }
        )
      }

      // Check worker limit
      const currentWorkerCount = organization._count.users
      if (currentWorkerCount >= organization.workerLimit) {
        const tierInfo = SUBSCRIPTION_TIERS[tier]
        const nextTiers = Object.entries(SUBSCRIPTION_TIERS)
          .filter(([, info]) => info.workerLimit > organization.workerLimit)
          .slice(0, 1)

        const upgradeInfo = nextTiers.length > 0 ? {
          nextTier: nextTiers[0][0],
          nextTierName: nextTiers[0][1].name,
          nextTierPrice: nextTiers[0][1].price,
          nextTierLimit: nextTiers[0][1].workerLimit,
        } : null

        return NextResponse.json(
          {
            error: "Worker limit reached",
            code: "WORKER_LIMIT_REACHED",
            message: `You've reached your ${tierInfo.name} plan limit of ${organization.workerLimit} workers. Upgrade to add more.`,
            currentLimit: organization.workerLimit,
            currentCount: currentWorkerCount,
            upgrade: upgradeInfo,
          },
          { status: 402 }
        )
      }
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Verify crew belongs to organization
    if (validatedData.crewId) {
      const crew = await prisma.crew.findFirst({
        where: {
          id: validatedData.crewId,
          organizationId: session.user.organizationId,
        },
      })

      if (!crew) {
        return NextResponse.json({ error: "Invalid crew" }, { status: 400 })
      }
    }

    // Verify department belongs to organization
    if (validatedData.departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: validatedData.departmentId,
          organizationId: session.user.organizationId,
        },
      })

      if (!department) {
        return NextResponse.json({ error: "Invalid department" }, { status: 400 })
      }
    }

    // Hash password if provided
    const passwordHash = validatedData.password
      ? await hashPassword(validatedData.password)
      : null

    const user = await prisma.user.create({
      data: {
        email: validatedData.email.toLowerCase(),
        name: validatedData.name,
        role: validatedData.role,
        position: validatedData.position,
        positionType: validatedData.positionType,
        phone: validatedData.phone,
        hireDate: validatedData.hireDate,
        crewId: validatedData.crewId,
        departmentId: validatedData.departmentId,
        customRoleId: validatedData.customRoleId,
        isControlRoomTrained: validatedData.isControlRoomTrained,
        isOilOperatorTrained: validatedData.isOilOperatorTrained,
        isUtilityOperatorTrained: validatedData.isUtilityOperatorTrained,
        isGasOperatorTrained: validatedData.isGasOperatorTrained,
        includeInStaffingCount: validatedData.includeInStaffingCount,
        singleTrainingCoverageOnly: validatedData.singleTrainingCoverageOnly,
        organizationId: session.user.organizationId,
        passwordHash,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        position: true,
        positionType: true,
        status: true,
        isControlRoomTrained: true,
        isOilOperatorTrained: true,
        isUtilityOperatorTrained: true,
        isGasOperatorTrained: true,
        includeInStaffingCount: true,
        singleTrainingCoverageOnly: true,
        customRoleId: true,
        crew: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        customRole: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: user, message: "User created successfully" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating user:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

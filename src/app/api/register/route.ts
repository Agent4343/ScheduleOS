import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { registerSchema } from "@/lib/validations"
import { generateSlug } from "@/lib/utils"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

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

    // Hash password
    const passwordHash = await hashPassword(validatedData.password)

    // Create organization if name provided
    let organizationId: string | undefined

    if (validatedData.organizationName) {
      const slug = generateSlug(validatedData.organizationName)

      // Check if org slug already exists
      const existingOrg = await prisma.organization.findUnique({
        where: { slug },
      })

      if (existingOrg) {
        return NextResponse.json(
          { error: "Organization with this name already exists" },
          { status: 400 }
        )
      }

      const organization = await prisma.organization.create({
        data: {
          name: validatedData.organizationName,
          slug,
          settings: {
            timezone: "America/St_Johns",
            weekStartsOn: 0,
            minStaffingAlertEnabled: true,
            emailNotificationsEnabled: true,
            smsNotificationsEnabled: false,
          },
        },
      })

      organizationId = organization.id

      // Create default rotation patterns for new organization
      await prisma.rotationPattern.createMany({
        data: [
          {
            organizationId,
            name: "3 on / 3 off",
            description: "Standard 3 days on, 3 days off rotation",
            daysOn: 3,
            daysOff: 3,
            includesNights: false,
            isDefault: true,
          },
          {
            organizationId,
            name: "3 on / 3 off (with nights)",
            description: "3 days on with night shift, 3 days off",
            daysOn: 3,
            daysOff: 3,
            includesNights: true,
            nightsAtStart: true,
            nightDays: 2,
          },
          {
            organizationId,
            name: "2 on / 2 off",
            description: "Standard 2 days on, 2 days off rotation",
            daysOn: 2,
            daysOff: 2,
            includesNights: false,
          },
          {
            organizationId,
            name: "14 on / 14 off",
            description: "Offshore rotation: 14 days on, 14 days off",
            daysOn: 14,
            daysOff: 14,
            includesNights: false,
          },
          {
            organizationId,
            name: "21 on / 21 off",
            description: "Extended offshore rotation: 21 days on, 21 days off",
            daysOn: 21,
            daysOff: 21,
            includesNights: false,
          },
        ],
      })

      // Create default crews
      const defaultCrews = ["A", "B", "C", "D"]
      const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"]

      const defaultPattern = await prisma.rotationPattern.findFirst({
        where: { organizationId, isDefault: true },
      })

      for (let i = 0; i < defaultCrews.length; i++) {
        await prisma.crew.create({
          data: {
            organizationId,
            name: `Crew ${defaultCrews[i]}`,
            color: colors[i],
            currentPhase: i * 3, // Offset each crew for rotation
            rotationPatternId: defaultPattern?.id,
          },
        })
      }

      // Create default staffing rules
      await prisma.staffingRule.createMany({
        data: [
          {
            organizationId,
            name: "Day Shift Minimum",
            shiftType: "DAY",
            minWorkers: 2,
            maxVacation: 1,
          },
          {
            organizationId,
            name: "Night Shift Minimum",
            shiftType: "NIGHT",
            minWorkers: 1,
            maxVacation: 1,
          },
        ],
      })
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email.toLowerCase(),
        name: validatedData.name,
        passwordHash,
        role: organizationId ? "ADMIN" : "WORKER",
        organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: organizationId
          ? "Account and organization created successfully"
          : "Account created successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    )
  }
}

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createRotationPatternSchema } from "@/lib/validations"
import {
  successResponse,
  createdResponse,
  errorResponse,
  handleApiError,
  withAuth,
} from "@/lib/api"

export const GET = withAuth(async (session) => {
  try {
    const patterns = await prisma.rotationPattern.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        _count: {
          select: { crews: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return successResponse(patterns)
  } catch (error) {
    return handleApiError(error, "fetch rotation patterns")
  }
})

// PATCH - Add missing default patterns to organization
export async function PATCH() {
  return withAuth(
    async (session) => {
      try {
        const organizationId = session.user.organizationId

        // Define all default patterns
        const defaultPatterns = [
          {
            name: "14 on / 14 off (with nights)",
            description: "Offshore rotation with alternating day/night rotations",
            daysOn: 14,
            daysOff: 14,
            includesNights: true,
            nightsAtStart: false,
            nightDays: 14,
          },
          {
            name: "21 on / 21 off (with nights)",
            description: "Extended offshore rotation with alternating day/night rotations",
            daysOn: 21,
            daysOff: 21,
            includesNights: true,
            nightsAtStart: false,
            nightDays: 21,
          },
        ]

        const added: string[] = []

        for (const pattern of defaultPatterns) {
          const existing = await prisma.rotationPattern.findFirst({
            where: { organizationId, name: pattern.name },
          })

          if (!existing) {
            await prisma.rotationPattern.create({
              data: { ...pattern, organizationId },
            })
            added.push(pattern.name)
          }
        }

        return successResponse({ added, message: `Added ${added.length} new patterns` })
      } catch (error) {
        return handleApiError(error, "add missing patterns")
      }
    },
    { requiredRoles: ["ADMIN"] }
  )()
}

export async function POST(request: NextRequest) {
  return withAuth(
    async (session) => {
      try {
        const body = await request.json()
        const validatedData = createRotationPatternSchema.parse(body)

        // Check for duplicate name
        const existingPattern = await prisma.rotationPattern.findFirst({
          where: {
            organizationId: session.user.organizationId,
            name: validatedData.name,
          },
        })

        if (existingPattern) {
          return errorResponse("A rotation pattern with this name already exists")
        }

        // If setting as default, unset other defaults
        if (validatedData.isDefault) {
          await prisma.rotationPattern.updateMany({
            where: {
              organizationId: session.user.organizationId,
              isDefault: true,
            },
            data: { isDefault: false },
          })
        }

        const pattern = await prisma.rotationPattern.create({
          data: {
            name: validatedData.name,
            description: validatedData.description,
            daysOn: validatedData.daysOn,
            daysOff: validatedData.daysOff,
            includesNights: validatedData.includesNights,
            nightsAtStart: validatedData.nightsAtStart,
            nightDays: validatedData.nightDays,
            isDefault: validatedData.isDefault,
            organizationId: session.user.organizationId,
          },
        })

        return createdResponse(pattern, "Rotation pattern created successfully")
      } catch (error) {
        return handleApiError(error, "create rotation pattern")
      }
    },
    { requiredRoles: ["ADMIN", "SUPERVISOR"] }
  )()
}

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

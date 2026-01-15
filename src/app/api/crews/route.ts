import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { createCrewSchema } from "@/lib/validations"
import {
  successResponse,
  createdResponse,
  errorResponse,
  handleApiError,
  withAuth,
} from "@/lib/api"

export const GET = withAuth(async (session) => {
  try {
    const crews = await prisma.crew.findMany({
      where: { organizationId: session.user.organizationId },
      include: {
        rotationPattern: {
          select: {
            id: true,
            name: true,
            daysOn: true,
            daysOff: true,
            includesNights: true,
          },
        },
        _count: {
          select: { workers: true },
        },
      },
      orderBy: { name: "asc" },
    })

    return successResponse(crews)
  } catch (error) {
    return handleApiError(error, "fetch crews")
  }
})

export async function POST(request: NextRequest) {
  return withAuth(
    async (session) => {
      try {
        const body = await request.json()
        const validatedData = createCrewSchema.parse(body)

        // Check for duplicate name
        const existingCrew = await prisma.crew.findFirst({
          where: {
            organizationId: session.user.organizationId,
            name: validatedData.name,
          },
        })

        if (existingCrew) {
          return errorResponse("A crew with this name already exists")
        }

        // Verify rotation pattern if provided
        if (validatedData.rotationPatternId) {
          const pattern = await prisma.rotationPattern.findFirst({
            where: {
              id: validatedData.rotationPatternId,
              organizationId: session.user.organizationId,
            },
          })

          if (!pattern) {
            return errorResponse("Invalid rotation pattern")
          }
        }

        const crew = await prisma.crew.create({
          data: {
            name: validatedData.name,
            description: validatedData.description,
            color: validatedData.color,
            organizationId: session.user.organizationId,
            rotationPatternId: validatedData.rotationPatternId,
          },
          include: {
            rotationPattern: {
              select: {
                id: true,
                name: true,
                daysOn: true,
                daysOff: true,
              },
            },
            _count: {
              select: { workers: true },
            },
          },
        })

        return createdResponse(crew, "Crew created successfully")
      } catch (error) {
        return handleApiError(error, "create crew")
      }
    },
    { requiredRoles: ["ADMIN", "SUPERVISOR"] }
  )()
}

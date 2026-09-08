import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { notFound, ServiceError } from "@/lib/services/errors"
import { coverageRequirementsSchema } from "@/lib/validations"

/**
 * Replace a role's sign-off requirements wholesale. The editor sends the
 * complete list, so adds, edits and removals arrive as one save.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const organizationId = auth.session.user.organizationId

    const role = await prisma.coverageRole.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
    if (!role) throw notFound("Coverage role")

    const { requirements } = await parseBody(coverageRequirementsSchema, request)

    // Every sign-off named — the real one and any stand-ins — must be ours
    const referenced = Array.from(
      new Set(requirements.flatMap((r) => [r.qualificationId, ...r.fallbackQualificationIds]))
    )
    if (referenced.length > 0) {
      const owned = await prisma.qualification.count({ where: { organizationId, id: { in: referenced } } })
      if (owned !== referenced.length) throw new ServiceError("Unknown sign-off", 400)
    }

    const saved = await prisma.$transaction(async (tx) => {
      // Fallbacks go with their requirement (FK cascade)
      await tx.coverageRequirement.deleteMany({ where: { coverageRoleId: params.id } })
      if (requirements.length === 0) return []

      for (const r of requirements) {
        await tx.coverageRequirement.create({
          data: {
            coverageRoleId: params.id,
            qualificationId: r.qualificationId,
            countDay: r.countDay,
            countNight: r.countNight,
            fallbacks: {
              create: r.fallbackQualificationIds.map((qualificationId, priority) => ({ qualificationId, priority })),
            },
          },
        })
      }

      return tx.coverageRequirement.findMany({
        where: { coverageRoleId: params.id },
        include: {
          qualification: { select: { id: true, code: true, name: true } },
          fallbacks: {
            orderBy: { priority: "asc" },
            select: { qualificationId: true, qualification: { select: { code: true, name: true } } },
          },
        },
      })
    })

    return apiOk(saved, { message: "Sign-off requirements saved" })
  } catch (error) {
    return handleRouteError(error, "Failed to save sign-off requirements")
  }
}

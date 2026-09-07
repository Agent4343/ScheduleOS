import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { ServiceError } from "@/lib/services/errors"
import { positionGroupSchema } from "@/lib/validations"

/** Position groups: OIM, Production Supervisor, Production Leads, OCR Ops, Ops Techs… */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const groups = await prisma.positionGroup.findMany({
      where: { organizationId: auth.session.user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        defaultCoverageRole: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    })
    return apiOk(groups)
  } catch (error) {
    return handleRouteError(error, "Failed to load position groups")
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const organizationId = auth.session.user.organizationId
    const body = await parseBody(positionGroupSchema, request)
    if (body.defaultCoverageRoleId) {
      const role = await prisma.coverageRole.findFirst({ where: { id: body.defaultCoverageRoleId, organizationId } })
      if (!role) throw new ServiceError("Invalid coverage role", 400)
    }
    const group = await prisma.positionGroup.create({ data: { ...body, organizationId } })
    return apiOk(group, { status: 201, message: "Position group created" })
  } catch (error) {
    return handleRouteError(error, "Failed to create position group")
  }
}

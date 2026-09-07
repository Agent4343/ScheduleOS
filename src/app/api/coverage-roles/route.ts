import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { coverageRoleSchema } from "@/lib/validations"

/** Coverage roles: the lines on the coverage sheet (Outside Ops, Control Room, OIM…). */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const roles = await prisma.coverageRole.findMany({
      where: { organizationId: auth.session.user.organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { defaultForGroups: true, dutyCodes: true } },
        requirements: { include: { qualification: { select: { id: true, code: true, name: true } } } },
      },
    })
    return apiOk(roles)
  } catch (error) {
    return handleRouteError(error, "Failed to load coverage roles")
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const body = await parseBody(coverageRoleSchema, request)
    const role = await prisma.coverageRole.create({
      data: { ...body, organizationId: auth.session.user.organizationId },
    })
    return apiOk(role, { status: 201, message: "Coverage role created" })
  } catch (error) {
    return handleRouteError(error, "Failed to create coverage role")
  }
}

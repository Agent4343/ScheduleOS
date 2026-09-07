import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { notFound } from "@/lib/services/errors"
import { updateCoverageRoleSchema } from "@/lib/validations"

async function requireRole(organizationId: string, id: string) {
  const role = await prisma.coverageRole.findFirst({ where: { id, organizationId }, select: { id: true } })
  if (!role) throw notFound("Coverage role")
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    await requireRole(auth.session.user.organizationId, params.id)
    const body = await parseBody(updateCoverageRoleSchema, request)
    const role = await prisma.coverageRole.update({ where: { id: params.id }, data: body })
    return apiOk(role, { message: "Coverage role updated" })
  } catch (error) {
    return handleRouteError(error, "Failed to update coverage role")
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    await requireRole(auth.session.user.organizationId, params.id)
    // Groups and duty codes pointing at it are set to null by the FK
    await prisma.coverageRole.delete({ where: { id: params.id } })
    return apiOk(null, { message: "Coverage role deleted" })
  } catch (error) {
    return handleRouteError(error, "Failed to delete coverage role")
  }
}

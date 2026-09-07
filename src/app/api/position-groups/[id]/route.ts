import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { ServiceError, notFound } from "@/lib/services/errors"
import { updatePositionGroupSchema } from "@/lib/validations"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const organizationId = auth.session.user.organizationId
    const existing = await prisma.positionGroup.findFirst({ where: { id: params.id, organizationId }, select: { id: true } })
    if (!existing) throw notFound("Position group")
    const body = await parseBody(updatePositionGroupSchema, request)
    if (body.defaultCoverageRoleId) {
      const role = await prisma.coverageRole.findFirst({ where: { id: body.defaultCoverageRoleId, organizationId } })
      if (!role) throw new ServiceError("Invalid coverage role", 400)
    }
    const group = await prisma.positionGroup.update({ where: { id: params.id }, data: body })
    return apiOk(group, { message: "Position group updated" })
  } catch (error) {
    return handleRouteError(error, "Failed to update position group")
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const existing = await prisma.positionGroup.findFirst({
      where: { id: params.id, organizationId: auth.session.user.organizationId },
      select: { id: true },
    })
    if (!existing) throw notFound("Position group")
    // Members are set to no group by the FK
    await prisma.positionGroup.delete({ where: { id: params.id } })
    return apiOk(null, { message: "Position group deleted" })
  } catch (error) {
    return handleRouteError(error, "Failed to delete position group")
  }
}

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { notFound } from "@/lib/services/errors"
import { updateQualificationSchema } from "@/lib/validations"

async function requireQualification(organizationId: string, id: string) {
  const found = await prisma.qualification.findFirst({ where: { id, organizationId }, select: { code: true } })
  if (!found) throw notFound("Sign-off")
  return found
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const organizationId = auth.session.user.organizationId
    const existing = await requireQualification(organizationId, params.id)
    const body = await parseBody(updateQualificationSchema, request)

    const qualification = await prisma.$transaction(async (tx) => {
      const updated = await tx.qualification.update({ where: { id: params.id }, data: body })
      // Workers store sign-offs by code, so a renamed code must be rewritten
      // on everyone holding it or they would silently lose it.
      if (body.code && body.code !== existing.code) {
        await tx.$executeRaw`
          UPDATE "User"
          SET "qualifications" = array_replace("qualifications", ${existing.code}, ${body.code})
          WHERE "organizationId" = ${organizationId} AND ${existing.code} = ANY("qualifications")`
      }
      return updated
    })
    return apiOk(qualification, { message: "Sign-off updated" })
  } catch (error) {
    return handleRouteError(error, "Failed to update sign-off")
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const organizationId = auth.session.user.organizationId
    const existing = await requireQualification(organizationId, params.id)

    await prisma.$transaction(async (tx) => {
      // Requirements referencing it go with it (FK cascade); strip the code
      // from the workers who hold it so nothing points at a ghost.
      await tx.qualification.delete({ where: { id: params.id } })
      await tx.$executeRaw`
        UPDATE "User"
        SET "qualifications" = array_remove("qualifications", ${existing.code})
        WHERE "organizationId" = ${organizationId} AND ${existing.code} = ANY("qualifications")`
    })
    return apiOk(null, { message: "Sign-off deleted" })
  } catch (error) {
    return handleRouteError(error, "Failed to delete sign-off")
  }
}

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { notFound } from "@/lib/services/errors"

/** Revoke an invitation: the link stops working immediately. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const found = await prisma.invitation.findFirst({
      where: { id: params.id, organizationId: auth.session.user.organizationId },
      select: { id: true },
    })
    if (!found) throw notFound("Invitation")
    await prisma.invitation.delete({ where: { id: params.id } })
    return apiOk(null, { message: "Invitation revoked" })
  } catch (error) {
    return handleRouteError(error, "Failed to revoke the invitation")
  }
}

import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { ServiceError } from "@/lib/services/errors"
import { checkUserCreateAllowed } from "@/lib/user-permissions"
import { generateInvitationToken, hashInvitationToken, invitationExpiry, invitationUrl } from "@/lib/invitations"
import { logAudit, AuditAction } from "@/lib/audit-log"

const inviteSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["ADMIN", "SUPERVISOR", "WORKER"]).default("WORKER"),
})

/** Pending invitations. Tokens are never returned — only their hash is stored. */
export async function GET() {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const invitations = await prisma.invitation.findMany({
      where: { organizationId: auth.session.user.organizationId },
      select: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    const now = new Date()
    return apiOk(invitations.map((i) => ({ ...i, expired: i.expiresAt < now })))
  } catch (error) {
    return handleRouteError(error, "Failed to load invitations")
  }
}

/**
 * Create an invitation and return its link.
 *
 * The link is shown once, here — the token is not stored, so it cannot be
 * retrieved later. Re-inviting replaces any existing invitation for that
 * address, which is also how you reissue a link somebody lost.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { user } = auth.session
    const organizationId = user.organizationId

    const body = await parseBody(inviteSchema, request)

    // Supervisors may only invite workers, same rule as creating them directly
    const denied = checkUserCreateAllowed(user.role, body.role)
    if (denied) throw new ServiceError(denied, 403)

    const alreadyAUser = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })
    if (alreadyAUser) throw new ServiceError("Someone with that email already has an account", 409)

    const token = generateInvitationToken()
    const invitation = await prisma.invitation.upsert({
      where: { organizationId_email: { organizationId, email: body.email } },
      update: {
        name: body.name ?? null,
        role: body.role,
        token: hashInvitationToken(token),
        expiresAt: invitationExpiry(),
        createdById: user.id,
      },
      create: {
        email: body.email,
        name: body.name ?? null,
        role: body.role,
        token: hashInvitationToken(token),
        expiresAt: invitationExpiry(),
        organizationId,
        createdById: user.id,
      },
      select: { id: true, email: true, name: true, role: true, expiresAt: true },
    })

    await logAudit({
      action: AuditAction.USER_CREATED,
      userId: user.id,
      organizationId,
      targetType: "Invitation",
      targetId: invitation.id,
      metadata: { invited: body.email, role: body.role },
    })

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? ""
    return apiOk(
      { invitation, url: invitationUrl(token, origin) },
      { status: 201, message: "Invitation created" }
    )
  } catch (error) {
    return handleRouteError(error, "Failed to create the invitation")
  }
}

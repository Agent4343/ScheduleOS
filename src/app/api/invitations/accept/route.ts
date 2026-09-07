import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { ServiceError } from "@/lib/services/errors"
import { hashInvitationToken } from "@/lib/invitations"
import { rateLimit, rateLimitResponse, rateLimitPresets, getClientIP } from "@/lib/rate-limit"

/**
 * Accepting an invitation. Public by necessity — the person has no account
 * yet — so both verbs are rate limited by IP, and a bad token is answered the
 * same way whether it never existed, expired, or was revoked.
 */

const acceptSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(8).max(200),
})

const INVALID = "This invitation link is not valid. It may have expired or been withdrawn — ask your administrator for a new one."

async function findLiveInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token: hashInvitationToken(token) },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!invitation || invitation.expiresAt < new Date()) return null
  return invitation
}

/** Describe the invitation, so the page can greet the person by name. */
export async function GET(request: NextRequest) {
  try {
    const limit = await rateLimit(`invite-check:${getClientIP(request)}`, rateLimitPresets.auth)
    if (!limit.success) return rateLimitResponse(limit.resetIn)

    const token = new URL(request.url).searchParams.get("token") ?? ""
    if (!token) throw new ServiceError(INVALID, 404)

    const invitation = await findLiveInvitation(token)
    if (!invitation) throw new ServiceError(INVALID, 404)

    return apiOk({
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      organizationName: invitation.organization.name,
    })
  } catch (error) {
    return handleRouteError(error, INVALID)
  }
}

/** Create the account the invitation is for, then retire the invitation. */
export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit(`invite-accept:${getClientIP(request)}`, rateLimitPresets.auth)
    if (!limit.success) return rateLimitResponse(limit.resetIn)

    const body = await parseBody(acceptSchema, request)
    const invitation = await findLiveInvitation(body.token)
    if (!invitation) throw new ServiceError(INVALID, 404)

    // Someone may have signed up with this address between invite and accept
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })
    if (existing) {
      throw new ServiceError("An account already exists for this email address. Try signing in instead.", 409)
    }

    const passwordHash = await hashPassword(body.password)

    // The role comes from the invitation, never from the request body, so an
    // invited worker cannot make themselves an administrator.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invitation.email,
          name: body.name,
          role: invitation.role,
          status: "ACTIVE",
          organizationId: invitation.organizationId,
          passwordHash,
        },
        select: { id: true, email: true, name: true, role: true },
      })
      // One use per link
      await tx.invitation.delete({ where: { id: invitation.id } })
      return created
    })

    return NextResponse.json(
      { success: true, data: user, message: "Your account is ready — sign in to continue." },
      { status: 201 }
    )
  } catch (error) {
    return handleRouteError(error, "Could not set up your account")
  }
}

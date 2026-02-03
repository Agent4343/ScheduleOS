import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { createInvitationSchema } from "@/lib/validations"
import { sendEmail, invitationEmail } from "@/lib/email"
import { generateToken } from "@/lib/utils"
import { SUBSCRIPTION_TIERS, isTrialExpired, hasUnlimitedAccess } from "@/lib/subscription"

// Invitation expires after 7 days
const INVITATION_EXPIRY_DAYS = 7

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can view invitations
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // "pending" or "all"

    const whereClause = {
      organizationId: session.user.organizationId,
      ...(status === "pending" && { expiresAt: { gt: new Date() } }),
    }

    const invitations = await prisma.invitation.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: invitations })
  } catch (error) {
    console.error("Error fetching invitations:", error)
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can send invitations
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Check subscription limits
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        workerLimit: true,
        trialEndsAt: true,
        _count: {
          select: {
            users: {
              where: {
                status: { in: ["ACTIVE", "INACTIVE", "ON_LEAVE"] },
              },
            },
            invitations: {
              where: {
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Check if user has unlimited access (specific account bypass)
    if (!hasUnlimitedAccess(session.user.email)) {
      // Check if trial has expired
      const tier = organization.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS
      if (tier === "TRIAL" && isTrialExpired(organization.trialEndsAt)) {
        return NextResponse.json(
          {
            error: "Trial expired",
            code: "TRIAL_EXPIRED",
            message: "Your free trial has expired. Please upgrade to continue adding workers."
          },
          { status: 402 }
        )
      }

      // Check worker limit (include pending invitations)
      const totalCount = organization._count.users + organization._count.invitations
      if (totalCount >= organization.workerLimit) {
        const tierInfo = SUBSCRIPTION_TIERS[tier]
        return NextResponse.json(
          {
            error: "Worker limit reached",
            code: "WORKER_LIMIT_REACHED",
            message: `You've reached your ${tierInfo.name} plan limit of ${organization.workerLimit} workers (including pending invitations). Upgrade to add more.`,
          },
          { status: 402 }
        )
      }
    }

    const body = await request.json()
    const validatedData = createInvitationSchema.parse(body)
    const email = validatedData.email.toLowerCase()

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists in your organization" },
        { status: 400 }
      )
    }

    // Clean up any expired invitations for this email first
    // This is necessary because the unique constraint (organizationId, email)
    // would otherwise block creating a new invitation after the old one expires
    await prisma.invitation.deleteMany({
      where: {
        email,
        organizationId: session.user.organizationId,
        expiresAt: { lte: new Date() },
      },
    })

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email,
        organizationId: session.user.organizationId,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvitation) {
      // Provide more helpful error message with the sent date
      const sentDate = existingInvitation.createdAt.toLocaleDateString()
      return NextResponse.json(
        {
          error: `An invitation was already sent to this email on ${sentDate}. You can delete the pending invitation from the workers page and send a new one.`,
          existingInvitationId: existingInvitation.id
        },
        { status: 400 }
      )
    }

    // Generate token and expiration date
    const token = generateToken(64)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        name: validatedData.name,
        role: validatedData.role,
        token,
        expiresAt,
        organizationId: session.user.organizationId,
        createdById: session.user.id,
      },
    })

    // Generate invite link
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000").replace(/\/$/, "")
    const inviteLink = `${baseUrl}/accept-invite?token=${token}`

    // Send invitation email
    const emailSent = await sendEmail({
      to: email,
      subject: `You've been invited to join ${organization.name} on ShiftSync`,
      html: invitationEmail(
        organization.name,
        session.user.name || "Your administrator",
        validatedData.role,
        inviteLink,
        expiresAt
      ),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
        emailSent,
        message: emailSent
          ? `Invitation sent to ${email}`
          : `Invitation created. Email could not be sent - please share the invite link manually.`,
        inviteLink: !emailSent ? inviteLink : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating invitation:", error)

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can delete invitations
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get("id")

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 })
    }

    // Verify invitation belongs to organization
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.user.organizationId,
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    await prisma.invitation.delete({
      where: { id: invitationId },
    })

    return NextResponse.json({ success: true, message: "Invitation deleted" })
  } catch (error) {
    console.error("Error deleting invitation:", error)
    return NextResponse.json({ error: "Failed to delete invitation" }, { status: 500 })
  }
}

// Resend invitation with new token and expiration
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and supervisors can resend invitations
    if (!["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get("id")

    if (!invitationId) {
      return NextResponse.json({ error: "Invitation ID is required" }, { status: 400 })
    }

    // Fetch organization for email
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true },
    })

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    // Verify invitation belongs to organization
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingInvitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    // Generate new token and expiration date
    const token = generateToken(64)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    // Update invitation with new token and expiration
    const invitation = await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token,
        expiresAt,
      },
    })

    // Generate invite link
    const baseUrl = (process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000").replace(/\/$/, "")
    const inviteLink = `${baseUrl}/accept-invite?token=${token}`

    // Send invitation email
    const emailSent = await sendEmail({
      to: invitation.email,
      subject: `You've been invited to join ${organization.name} on ShiftSync`,
      html: invitationEmail(
        organization.name,
        session.user.name || "Your administrator",
        invitation.role,
        inviteLink,
        expiresAt
      ),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
        emailSent,
        message: emailSent
          ? `Invitation resent to ${invitation.email}`
          : `Invitation updated. Email could not be sent - please share the invite link manually.`,
        inviteLink: !emailSent ? inviteLink : undefined,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error resending invitation:", error)
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 })
  }
}

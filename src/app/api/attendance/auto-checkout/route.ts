import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"

/**
 * Constant-time comparison of a request-supplied secret against the
 * configured one. Returns false when the secret isn't configured at all.
 */
function isValidCronSecret(supplied: string | null): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || !supplied) return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Close open check-ins older than the organization's auto-checkout window.
 * Returns the number of check-ins closed.
 */
async function autoCheckoutOrganization(org: {
  id: string
  settings: unknown
}): Promise<number> {
  const settings = (org.settings ?? {}) as Record<string, unknown>
  const hours = Number(settings.autoCheckoutHours)
  if (!settings.autoCheckoutEnabled || !Number.isFinite(hours) || hours <= 0) {
    return 0
  }

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  const result = await prisma.shiftCheckIn.updateMany({
    where: {
      user: { organizationId: org.id },
      checkOutTime: null,
      checkInTime: { lte: cutoffTime },
    },
    data: {
      checkOutTime: new Date(),
      autoCheckedOut: true,
    },
  })

  return result.count
}

// POST - Auto-checkout workers after shift duration
//
// Two callers:
//  - a cron job carrying `x-cron-secret`, which runs across every organization
//  - an ADMIN clicking "run now", which only touches their own organization
export async function POST(request: NextRequest) {
  try {
    const isCron = isValidCronSecret(request.headers.get("x-cron-secret"))

    let organizations: Array<{ id: string; settings: unknown }>

    if (isCron) {
      organizations = await prisma.organization.findMany({
        select: { id: true, settings: true },
      })
    } else {
      const auth = await requireAuth({ roles: ["ADMIN"] })
      if (auth.error) return auth.error

      const org = await prisma.organization.findUnique({
        where: { id: auth.session.user.organizationId },
        select: { id: true, settings: true },
      })
      organizations = org ? [org] : []
    }

    let totalCheckedOut = 0
    for (const org of organizations) {
      totalCheckedOut += await autoCheckoutOrganization(org)
    }

    return NextResponse.json({
      success: true,
      message: `Auto-checked out ${totalCheckedOut} workers`,
      count: totalCheckedOut,
    })
  } catch (error) {
    console.error("Error in auto-checkout:", error)
    return NextResponse.json({ error: "Failed to auto-checkout" }, { status: 500 })
  }
}

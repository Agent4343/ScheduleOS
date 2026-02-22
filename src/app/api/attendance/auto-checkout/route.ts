import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

// POST - Auto-checkout workers after shift duration
// Can be called by a cron job or manually by an admin
export async function POST(request: NextRequest) {
  try {
    // Allow both authenticated admin calls and cron calls with secret
    const cronSecret = request.headers.get("x-cron-secret")
    const isAuthorizedCron = cronSecret === process.env.CRON_SECRET

    if (!isAuthorizedCron) {
      const session = await getServerSession(authOptions)
      if (!session?.user?.organizationId || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Find all organizations with auto-checkout enabled
    const organizations = await prisma.organization.findMany({
      select: { id: true, settings: true },
    })

    let totalCheckedOut = 0

    for (const org of organizations) {
      const settings = org.settings as Record<string, unknown> | null
      if (!settings?.autoCheckoutEnabled || !settings?.autoCheckoutHours) continue

      const hours = settings.autoCheckoutHours as number
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)

      // Find check-ins that are still open and older than the cutoff
      const openCheckIns = await prisma.shiftCheckIn.findMany({
        where: {
          user: { organizationId: org.id },
          checkOutTime: null,
          checkInTime: { lte: cutoffTime },
        },
      })

      if (openCheckIns.length > 0) {
        await prisma.shiftCheckIn.updateMany({
          where: {
            id: { in: openCheckIns.map((c) => c.id) },
          },
          data: {
            checkOutTime: new Date(),
            autoCheckedOut: true,
          },
        })

        totalCheckedOut += openCheckIns.length
      }
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

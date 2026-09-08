import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { findCoverage } from "@/lib/services/coverage"
import { addDaysUTC, normalizeToUTCMidnight } from "@/lib/timezone"

/**
 * The days ahead that cannot be staffed, and what is missing on each.
 *
 * A colour on a board only helps someone who opens the board. This is the
 * same evaluation reduced to "what needs fixing", so it can sit on the
 * dashboard where it is seen without being looked for.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error

    const daysParam = Number.parseInt(new URL(request.url).searchParams.get("days") ?? "", 10)
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 92) : 21

    const start = normalizeToUTCMidnight(new Date())
    const end = addDaysUTC(start, days - 1)
    const { configured, days: evaluated } = await findCoverage(auth.session.user.organizationId, start, end)

    const gaps = evaluated
      .map((day) => ({
        date: day.date,
        problems: day.lines
          .filter((l) => l.status === "red")
          .map((l) => ({
            role: l.roleName,
            shift: l.shift,
            have: l.have,
            min: l.min,
            // Which sign-offs cannot be filled, if that is the reason
            missingSignOffs: l.signOffs.filter((s) => s.filled < s.need).map((s) => ({ name: s.name, short: s.need - s.filled })),
          })),
      }))
      .filter((d) => d.problems.length > 0)

    const standInDays = evaluated.filter((d) => d.lines.some((l) => l.standIns > 0)).length

    return apiOk({ configured, days, gaps, standInDays })
  } catch (error) {
    return handleRouteError(error, "Failed to check coverage")
  }
}

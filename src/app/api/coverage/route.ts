import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { ServiceError } from "@/lib/services/errors"
import { findCoverage } from "@/lib/services/coverage"
import { daysDifference, toUTCDate } from "@/lib/timezone"

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/coverage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Per-day, per-role coverage with red/amber/green status and the roster.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const { searchParams } = new URL(request.url)
    const s = searchParams.get("startDate") ?? ""
    const e = searchParams.get("endDate") ?? ""
    if (!DATE.test(s) || !DATE.test(e)) throw new ServiceError("startDate and endDate (YYYY-MM-DD) are required", 400)
    const start = toUTCDate(s)
    const end = toUTCDate(e)
    if (end < start) throw new ServiceError("endDate must be on or after startDate", 400)
    if (daysDifference(start, end) > 92) throw new ServiceError("At most three months at a time", 400)

    return apiOk(await findCoverage(auth.session.user.organizationId, start, end))
  } catch (error) {
    return handleRouteError(error, "Failed to evaluate coverage")
  }
}

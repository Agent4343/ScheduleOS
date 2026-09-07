import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError, parseBody } from "@/lib/api-helpers"
import { bulkScheduleSchema } from "@/lib/validations"
import { setShiftOverrideRange } from "@/lib/services/schedules"
import { getClientIP } from "@/lib/rate-limit"

/**
 * POST /api/schedules/bulk
 * Set one shift type for a worker on every day in a range, atomically.
 * Replaces the UI's old one-request-per-day loop.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error
    const { session } = auth

    const body = await parseBody(bulkScheduleSchema, request)
    const result = await setShiftOverrideRange(
      { organizationId: session.user.organizationId, userId: session.user.id, ipAddress: getClientIP(request) },
      {
        userId: body.userId,
        startDate: body.startDate,
        endDate: body.endDate,
        shiftType: body.shiftType,
        customShiftCode: body.customShiftCode,
        reason: body.overrideReason,
      }
    )

    return apiOk({ days: result.days, worker: { id: result.worker.id, name: result.worker.name } }, {
      message: `Updated ${result.days} day(s)`,
    })
  } catch (error) {
    return handleRouteError(error, "Failed to update schedule")
  }
}

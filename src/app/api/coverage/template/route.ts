import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { applyOffshoreOperationsTemplate } from "@/lib/services/coverage-template"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getClientIP } from "@/lib/rate-limit"

/** POST /api/coverage/template — set up roles, groups and duty codes like the operations workbook. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const actor = { organizationId: auth.session.user.organizationId, userId: auth.session.user.id, ipAddress: getClientIP(request) }
    const result = await applyOffshoreOperationsTemplate(actor)
    await logAudit({
      action: AuditAction.ORGANIZATION_UPDATED,
      userId: actor.userId,
      organizationId: actor.organizationId,
      targetType: "Coverage",
      metadata: { template: "offshore-operations", ...result },
      ipAddress: actor.ipAddress,
    })
    return apiOk(result, { message: "Offshore operations template applied" })
  } catch (error) {
    return handleRouteError(error, "Failed to apply template")
  }
}

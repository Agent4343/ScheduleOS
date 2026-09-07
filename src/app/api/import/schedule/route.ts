import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"
import { ServiceError } from "@/lib/services/errors"
import { parseWorkbook, planImport, applyImport } from "@/lib/services/schedule-import"
import { logAudit, AuditAction } from "@/lib/audit-log"

/** Spreadsheets are small; this is a guard against a mistaken upload. */
const MAX_BYTES = 15 * 1024 * 1024

// Parsing a year of shifts takes longer than the default edge budget
export const maxDuration = 120

/**
 * Import a roster workbook.
 *
 * Always returns a plan. Only writes when `commit` is "true", so the client
 * previews first and the user confirms what the parser decided.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const { user } = auth.session

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) throw new ServiceError("No file was uploaded", 400)
    if (file.size === 0) throw new ServiceError("The uploaded file is empty", 400)
    if (file.size > MAX_BYTES) throw new ServiceError("That file is larger than 15MB", 400)

    const sheet = typeof form.get("sheet") === "string" ? (form.get("sheet") as string) : undefined
    const commit = form.get("commit") === "true"

    let parsed
    try {
      parsed = await parseWorkbook(await file.arrayBuffer(), sheet)
    } catch {
      throw new ServiceError("That file could not be read as a spreadsheet", 400)
    }

    const plan = await planImport(user.organizationId, parsed)
    if (!commit) return apiOk({ plan, imported: null })

    const result = await applyImport(
      { userId: user.id, organizationId: user.organizationId },
      parsed,
      {
        createMissingPeople: form.get("createMissingPeople") === "true",
        replaceRange: form.get("replaceRange") !== "false",
      }
    )

    await logAudit({
      action: AuditAction.WORKER_IMPORTED,
      userId: user.id,
      organizationId: user.organizationId,
      targetType: "Schedule",
      metadata: { source: "spreadsheet-import", sheet: parsed.sheetName, fileName: file.name, ...result },
    })

    return apiOk({ plan, imported: result }, { message: "Schedule imported" })
  } catch (error) {
    return handleRouteError(error, "Failed to import the schedule")
  }
}

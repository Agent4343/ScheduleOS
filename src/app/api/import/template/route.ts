import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { handleRouteError } from "@/lib/api-helpers"
import { buildImportTemplate, templateFileName } from "@/lib/services/import-template"
import { toUTCDate } from "@/lib/timezone"

/** Download a blank roster workbook, built from this organization's own setup. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN", "SUPERVISOR"] })
    if (auth.error) return auth.error

    const params = new URL(request.url).searchParams
    const startParam = params.get("start")
    const start = startParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? toUTCDate(startParam) : new Date()
    const days = Number.parseInt(params.get("days") ?? "", 10)

    const wb = await buildImportTemplate(auth.session.user.organizationId, {
      start,
      days: Number.isFinite(days) ? days : undefined,
    })
    const buffer = await wb.xlsx.writeBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${templateFileName(start)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleRouteError(error, "Failed to build the template")
  }
}

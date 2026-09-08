import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api-auth"
import { apiOk, handleRouteError } from "@/lib/api-helpers"

/** Has the welcome walkthrough played for this person yet? */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    const me = await prisma.user.findUnique({
      where: { id: auth.session.user.id },
      select: { hasSeenWelcome: true, role: true },
    })
    return apiOk({ hasSeenWelcome: me?.hasSeenWelcome ?? true, role: me?.role ?? "WORKER" })
  } catch (error) {
    return handleRouteError(error, "Failed to check the walkthrough")
  }
}

/** Mark it played, whether they watched it through or skipped. */
export async function POST() {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error
    await prisma.user.update({
      where: { id: auth.session.user.id },
      data: { hasSeenWelcome: true },
    })
    return apiOk(null)
  } catch (error) {
    return handleRouteError(error, "Failed to save that")
  }
}

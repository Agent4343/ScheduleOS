import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import type { Role } from "@/lib/navigation"

/**
 * Server-side page guard. Call from a route-group layout:
 *
 *   export default async function StaffLayout({ children }) {
 *     await requirePageRole(["ADMIN", "SUPERVISOR"])
 *     return children
 *   }
 *
 * Unauthenticated users go to /login; authenticated users without the role
 * go to /dashboard. The API routes enforce the same roles independently —
 * this only stops people landing on a form they cannot submit.
 */
export async function requirePageRole(roles: Role[]) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }
  if (!roles.includes(session.user.role as Role)) {
    redirect("/dashboard?denied=1")
  }
  return session
}

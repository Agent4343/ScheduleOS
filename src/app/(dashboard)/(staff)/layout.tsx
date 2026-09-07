import type { ReactNode } from "react"
import { requirePageRole } from "@/lib/auth/require-role"
import { STAFF } from "@/lib/navigation"

/**
 * Pages under (staff) are for admins and supervisors: workers, crews,
 * reports, onboarding, the AI assistant. Workers are sent to /dashboard.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requirePageRole(STAFF)
  return children
}

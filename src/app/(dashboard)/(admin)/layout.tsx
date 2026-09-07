import type { ReactNode } from "react"
import { requirePageRole } from "@/lib/auth/require-role"

/** Pages under (admin) are admin-only (audit log). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole(["ADMIN"])
  return children
}

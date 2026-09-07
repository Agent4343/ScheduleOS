"use client"

import { useSession } from "next-auth/react"
import type { Role } from "@/lib/navigation"

/**
 * The signed-in user's role, for showing or hiding controls in client
 * components. Page-level access is enforced server-side by requirePageRole;
 * use this for the finer cuts (an Edit button, a role dropdown).
 */
export function useRole() {
  const { data: session, status } = useSession()
  const role = (session?.user?.role as Role | undefined) ?? null
  return {
    role,
    userId: session?.user?.id ?? null,
    loading: status === "loading",
    isAdmin: role === "ADMIN",
    /** Admin or supervisor — the people who manage schedules and workers */
    isStaff: role === "ADMIN" || role === "SUPERVISOR",
    isWorker: role === "WORKER",
  }
}

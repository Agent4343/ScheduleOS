import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export interface AuthenticatedSession {
  user: {
    id: string
    email: string
    name: string
    role: "ADMIN" | "SUPERVISOR" | "WORKER"
    organizationId: string
  }
}

/**
 * Get authenticated session or return an error response.
 * Use in API routes to replace the repeated auth boilerplate.
 *
 * Usage:
 *   const auth = await requireAuth()
 *   if (auth.error) return auth.error
 *   const { session } = auth
 */
export async function requireAuth(options?: {
  roles?: Array<"ADMIN" | "SUPERVISOR" | "WORKER">
}): Promise<
  | { session: AuthenticatedSession; error?: never }
  | { session?: never; error: NextResponse }
> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.organizationId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (options?.roles && !options.roles.includes(session.user.role as "ADMIN" | "SUPERVISOR" | "WORKER")) {
    return {
      error: NextResponse.json(
        { error: `Requires ${options.roles.join(" or ")} role` },
        { status: 403 }
      ),
    }
  }

  return { session: session as unknown as AuthenticatedSession }
}

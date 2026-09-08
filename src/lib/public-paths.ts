/**
 * Which paths are reachable without signing in.
 *
 * Kept out of middleware.ts so it can be tested. Adding a page that people
 * must reach *before* they have an account — accepting an invitation, say —
 * and forgetting this list sends them to the sign-in screen they cannot get
 * past, and nothing about the code looks wrong.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/pricing",
  // Accepting an invitation: the person has no account yet, by definition
  "/invite",
  // Legal + contact pages are linked from the landing page, footer
  // and cookie banner, so they must be reachable when logged out.
  "/contact",
  "/terms",
  "/privacy",
  "/cookies",
  "/api/auth",
  "/api/health",
  "/api/register",
  "/api/stripe",
  // Only the accept endpoints — NOT /api/invitations itself, which lists and
  // creates invitations and must stay behind an admin check.
  "/api/invitations/accept",
] as const

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`))
}

export const PUBLIC_PATH_PREFIXES = PUBLIC_PREFIXES

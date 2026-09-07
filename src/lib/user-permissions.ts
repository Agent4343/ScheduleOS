import type { UserRole, UserStatus } from "@prisma/client"

/**
 * Who may change what on a user account.
 *
 * Rules, in plain terms:
 *  - Only an ADMIN may assign or change a role, or change account status.
 *  - A SUPERVISOR may create and edit WORKER accounts only; they cannot
 *    touch ADMIN or SUPERVISOR accounts at all.
 *  - Nobody may change their own role or status through this API
 *    (deactivating yourself is handled by /api/auth/delete-account).
 *
 * Returns an error message, or null when the change is allowed.
 */
export function checkUserChangeAllowed(input: {
  actorId: string
  actorRole: UserRole
  targetId: string
  targetRole: UserRole
  newRole?: UserRole
  newStatus?: UserStatus
}): string | null {
  const { actorId, actorRole, targetId, targetRole, newRole, newStatus } = input
  const isSelf = actorId === targetId

  if (actorRole !== "ADMIN") {
    if (targetRole !== "WORKER") {
      return "Supervisors can only edit worker accounts"
    }
    if (newRole !== undefined && newRole !== "WORKER") {
      return "Only an admin can assign roles"
    }
    if (newStatus !== undefined) {
      return "Only an admin can change account status"
    }
  }

  if (isSelf) {
    if (newRole !== undefined && newRole !== targetRole) {
      return "You cannot change your own role"
    }
    if (newStatus !== undefined && newStatus !== "ACTIVE") {
      return "You cannot deactivate your own account here"
    }
  }

  return null
}

/**
 * Whether the given role may create an account with `newRole`.
 */
export function checkUserCreateAllowed(actorRole: UserRole, newRole: UserRole): string | null {
  if (actorRole !== "ADMIN" && newRole !== "WORKER") {
    return "Only an admin can create admin or supervisor accounts"
  }
  return null
}

/**
 * True when the change would leave the organization without an active admin.
 * `activeAdminCount` is the number of ACTIVE admins *including* the target.
 */
export function wouldRemoveLastAdmin(input: {
  targetRole: UserRole
  targetStatus: UserStatus
  newRole?: UserRole
  newStatus?: UserStatus
  activeAdminCount: number
}): boolean {
  const { targetRole, targetStatus, newRole, newStatus, activeAdminCount } = input
  const isActiveAdminNow = targetRole === "ADMIN" && targetStatus === "ACTIVE"
  if (!isActiveAdminNow) return false

  const roleAfter = newRole ?? targetRole
  const statusAfter = newStatus ?? targetStatus
  const staysActiveAdmin = roleAfter === "ADMIN" && statusAfter === "ACTIVE"

  return !staysActiveAdmin && activeAdminCount <= 1
}

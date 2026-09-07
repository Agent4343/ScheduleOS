import { prisma } from "./prisma"
import { DEFAULT_TIMEZONE, isValidTimeZone } from "./timezone"

/**
 * The IANA timezone an organization runs its shifts in.
 * Falls back to DEFAULT_TIMEZONE when unset or invalid.
 */
export async function getOrganizationTimeZone(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })
  const tz = (org?.settings as { timezone?: unknown } | null)?.timezone
  return typeof tz === "string" && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE
}

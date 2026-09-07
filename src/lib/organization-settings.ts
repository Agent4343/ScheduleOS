import type { Prisma } from "@prisma/client"
import {
  PROTECTED_ORGANIZATION_SETTINGS,
  type OrganizationSettingsInput,
} from "./validations"

type SettingsRecord = Record<string, unknown>

function asRecord(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SettingsRecord)
    : {}
}

/**
 * Apply a validated partial settings update over the stored settings JSON.
 *
 * - Keys the client did not send are kept as they are.
 * - Keys the client sent replace the stored value.
 * - Billing keys owned by the Stripe webhook are always taken from the
 *   stored value, even if the client tried to send them.
 */
export function mergeOrganizationSettings(
  stored: Prisma.JsonValue | null | undefined,
  update: OrganizationSettingsInput
): Prisma.InputJsonObject {
  const current = asRecord(stored)
  const merged: SettingsRecord = { ...current, ...update }

  for (const key of PROTECTED_ORGANIZATION_SETTINGS) {
    if (key in current) {
      merged[key] = current[key]
    } else {
      delete merged[key]
    }
  }

  return merged as Prisma.InputJsonObject
}

/**
 * Overwrite billing keys on the stored settings without touching anything
 * else. Used by the Stripe webhook.
 */
export function mergeBillingSettings(
  stored: Prisma.JsonValue | null | undefined,
  billing: Partial<Record<(typeof PROTECTED_ORGANIZATION_SETTINGS)[number], unknown>>
): Prisma.InputJsonObject {
  return { ...asRecord(stored), ...billing } as Prisma.InputJsonObject
}

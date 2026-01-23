import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export interface BillingSettings {
  plan?: string
  status?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: string
  trialEndsAt?: string
  seatCount?: number
  requestedPlan?: string
}

export function getBillingSettings(settings: unknown): BillingSettings {
  if (!settings || typeof settings !== "object") {
    return {}
  }
  const record = settings as Record<string, unknown>
  if (!record.billing || typeof record.billing !== "object") {
    return {}
  }
  return record.billing as BillingSettings
}

export async function updateOrganizationBilling(
  organizationId: string,
  update: BillingSettings
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const existingSettings =
    organization?.settings && typeof organization.settings === "object"
      ? (organization.settings as Record<string, unknown>)
      : {}

  const existingBilling = getBillingSettings(existingSettings)

  const mergedSettings: Prisma.InputJsonValue = {
    ...existingSettings,
    billing: {
      ...existingBilling,
      ...update,
    },
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: mergedSettings,
    },
  })
}

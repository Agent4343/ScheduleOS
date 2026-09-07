import { describe, it, expect } from "vitest"
import { mergeOrganizationSettings, mergeBillingSettings } from "../organization-settings"
import { organizationSettingsSchema, updateUserSchema } from "../validations"

const stored = {
  timezone: "America/St_Johns",
  weekStartsOn: 0,
  autoCheckoutEnabled: true,
  autoCheckoutHours: 12,
  shiftColors: { DAY: { bg: "#ffffff", text: "#000000" } },
  plan: "professional",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_456",
  subscriptionStatus: "active",
}

describe("organizationSettingsSchema", () => {
  it("has no defaults, so omitted keys stay undefined", () => {
    expect(organizationSettingsSchema.parse({})).toEqual({})
  })

  it("strips unknown keys, including billing fields", () => {
    const parsed = organizationSettingsSchema.parse({
      timezone: "UTC",
      plan: "enterprise",
      stripeCustomerId: "cus_evil",
      somethingElse: 1,
    })
    expect(parsed).toEqual({ timezone: "UTC" })
  })

  it("rejects out-of-range values", () => {
    expect(() => organizationSettingsSchema.parse({ autoCheckoutHours: 0 })).toThrow()
    expect(() => organizationSettingsSchema.parse({ weekStartsOn: 7 })).toThrow()
    expect(() => organizationSettingsSchema.parse({ shiftColors: { DAY: { bg: "red", text: "#000000" } } })).toThrow()
  })
})

describe("mergeOrganizationSettings", () => {
  it("keeps every stored key the client did not send", () => {
    const merged = mergeOrganizationSettings(stored, { emailNotificationsEnabled: false })
    expect(merged).toEqual({ ...stored, emailNotificationsEnabled: false })
  })

  it("never lets a client change billing keys", () => {
    const merged = mergeOrganizationSettings(stored, {
      timezone: "UTC",
      // simulate a client that bypassed validation
      ...({ plan: "enterprise", stripeCustomerId: "cus_evil" } as object),
    })
    expect(merged.plan).toBe("professional")
    expect(merged.stripeCustomerId).toBe("cus_123")
    expect(merged.timezone).toBe("UTC")
  })

  it("does not invent billing keys when none are stored", () => {
    const merged = mergeOrganizationSettings(
      { timezone: "UTC" },
      { ...({ plan: "enterprise" } as object) }
    )
    expect("plan" in merged).toBe(false)
  })

  it("tolerates null or malformed stored settings", () => {
    expect(mergeOrganizationSettings(null, { timezone: "UTC" })).toEqual({ timezone: "UTC" })
    expect(mergeOrganizationSettings("junk", { timezone: "UTC" })).toEqual({ timezone: "UTC" })
  })
})

describe("mergeBillingSettings", () => {
  it("updates billing keys and leaves everything else alone", () => {
    const merged = mergeBillingSettings(stored, { subscriptionStatus: "canceled" })
    expect(merged).toEqual({ ...stored, subscriptionStatus: "canceled" })
  })
})

describe("updateUserSchema", () => {
  it("has no password field", () => {
    const parsed = updateUserSchema.parse({ name: "Jane Doe", password: "hunter2hunter2" })
    expect("password" in parsed).toBe(false)
  })

  it("does not apply create-time defaults on a partial update", () => {
    // The role/status guards rely on "not sent" meaning "unchanged".
    const parsed = updateUserSchema.parse({ name: "Jane Doe" })
    expect(parsed.role).toBeUndefined()
    expect(parsed.status).toBeUndefined()
    expect(parsed.positionType).toBeUndefined()
  })
})

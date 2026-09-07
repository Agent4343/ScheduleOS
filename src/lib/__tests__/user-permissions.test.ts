import { describe, it, expect } from "vitest"
import {
  checkUserChangeAllowed,
  checkUserCreateAllowed,
  wouldRemoveLastAdmin,
} from "../user-permissions"

describe("checkUserChangeAllowed", () => {
  const admin = { actorId: "a1", actorRole: "ADMIN" as const }
  const supervisor = { actorId: "s1", actorRole: "SUPERVISOR" as const }

  it("lets an admin promote a worker to admin", () => {
    expect(
      checkUserChangeAllowed({ ...admin, targetId: "w1", targetRole: "WORKER", newRole: "ADMIN" })
    ).toBeNull()
  })

  it("blocks a supervisor from assigning any non-worker role", () => {
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "w1", targetRole: "WORKER", newRole: "ADMIN" })
    ).toMatch(/only an admin/i)
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "w1", targetRole: "WORKER", newRole: "SUPERVISOR" })
    ).toMatch(/only an admin/i)
  })

  it("blocks a supervisor from editing admin or supervisor accounts", () => {
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "a1", targetRole: "ADMIN" })
    ).toMatch(/worker accounts/i)
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "s2", targetRole: "SUPERVISOR" })
    ).toMatch(/worker accounts/i)
  })

  it("blocks a supervisor from changing account status", () => {
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "w1", targetRole: "WORKER", newStatus: "TERMINATED" })
    ).toMatch(/status/i)
  })

  it("lets a supervisor edit a worker's profile fields", () => {
    expect(checkUserChangeAllowed({ ...supervisor, targetId: "w1", targetRole: "WORKER" })).toBeNull()
    // Sending role: WORKER unchanged is fine
    expect(
      checkUserChangeAllowed({ ...supervisor, targetId: "w1", targetRole: "WORKER", newRole: "WORKER" })
    ).toBeNull()
  })

  it("blocks self role or status changes even for admins", () => {
    expect(
      checkUserChangeAllowed({ ...admin, targetId: "a1", targetRole: "ADMIN", newRole: "WORKER" })
    ).toMatch(/own role/i)
    expect(
      checkUserChangeAllowed({ ...admin, targetId: "a1", targetRole: "ADMIN", newStatus: "INACTIVE" })
    ).toMatch(/own account/i)
    // Re-sending the same values is not a change
    expect(
      checkUserChangeAllowed({ ...admin, targetId: "a1", targetRole: "ADMIN", newRole: "ADMIN", newStatus: "ACTIVE" })
    ).toBeNull()
  })
})

describe("checkUserCreateAllowed", () => {
  it("only admins can create admins or supervisors", () => {
    expect(checkUserCreateAllowed("ADMIN", "ADMIN")).toBeNull()
    expect(checkUserCreateAllowed("SUPERVISOR", "WORKER")).toBeNull()
    expect(checkUserCreateAllowed("SUPERVISOR", "ADMIN")).toMatch(/only an admin/i)
    expect(checkUserCreateAllowed("SUPERVISOR", "SUPERVISOR")).toMatch(/only an admin/i)
  })
})

describe("wouldRemoveLastAdmin", () => {
  const activeAdmin = { targetRole: "ADMIN" as const, targetStatus: "ACTIVE" as const }

  it("flags demoting or deactivating the only active admin", () => {
    expect(wouldRemoveLastAdmin({ ...activeAdmin, newRole: "WORKER", activeAdminCount: 1 })).toBe(true)
    expect(wouldRemoveLastAdmin({ ...activeAdmin, newStatus: "TERMINATED", activeAdminCount: 1 })).toBe(true)
  })

  it("allows it when another active admin exists", () => {
    expect(wouldRemoveLastAdmin({ ...activeAdmin, newRole: "WORKER", activeAdminCount: 2 })).toBe(false)
  })

  it("ignores changes that keep the admin active, or targets that aren't active admins", () => {
    expect(wouldRemoveLastAdmin({ ...activeAdmin, newRole: "ADMIN", newStatus: "ACTIVE", activeAdminCount: 1 })).toBe(false)
    expect(
      wouldRemoveLastAdmin({ targetRole: "WORKER", targetStatus: "ACTIVE", newStatus: "TERMINATED", activeAdminCount: 1 })
    ).toBe(false)
  })
})

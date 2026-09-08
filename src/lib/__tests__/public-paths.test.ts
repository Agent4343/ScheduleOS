import { describe, it, expect } from "vitest"
import { isPublicPath } from "../public-paths"

describe("isPublicPath", () => {
  it("lets people reach the pages they need before they have an account", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/register")).toBe(true)
    // Accepting an invitation — this was missed once, and it silently broke
    // the entire invite flow: invited people were redirected to sign in.
    expect(isPublicPath("/invite/abc123")).toBe(true)
    expect(isPublicPath("/api/invitations/accept")).toBe(true)
    expect(isPublicPath("/api/invitations/accept?token=x")).toBe(true)
  })

  it("keeps the rest of the app behind sign-in", () => {
    expect(isPublicPath("/dashboard")).toBe(false)
    expect(isPublicPath("/schedule")).toBe(false)
    expect(isPublicPath("/coverage")).toBe(false)
    expect(isPublicPath("/settings")).toBe(false)
    expect(isPublicPath("/api/users")).toBe(false)
    expect(isPublicPath("/api/import/schedule")).toBe(false)
  })

  it("does not open the admin invitation routes", () => {
    // Listing and creating invitations must stay behind an admin check; only
    // the accept endpoint is public.
    expect(isPublicPath("/api/invitations")).toBe(false)
    expect(isPublicPath("/api/invitations/some-id")).toBe(false)
  })

  it("does not match a path that merely starts with the same letters", () => {
    expect(isPublicPath("/registered-users")).toBe(false)
    expect(isPublicPath("/loginhistory")).toBe(false)
    expect(isPublicPath("/invitations")).toBe(false)
  })
})

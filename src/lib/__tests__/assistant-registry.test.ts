import { describe, it, expect, vi } from "vitest"

// The registry imports tools that import the Prisma client; none of these
// tests touch the database.
vi.mock("../prisma", () => ({ prisma: {} }))

import { assistantTools, toAnthropicTools, runTool } from "../assistant/registry"

const ctx = { organizationId: "org", userId: "u1", userRole: "ADMIN" as const, timeZone: "UTC" }

describe("assistant tool registry", () => {
  it("exposes fourteen uniquely named tools", () => {
    const names = assistantTools.map((t) => t.name)
    expect(names).toHaveLength(14)
    expect(new Set(names).size).toBe(14)
    expect(toAnthropicTools().map((t) => t.name)).toEqual(names)
  })

  it("every JSON-schema required property is also required by the Zod schema", () => {
    for (const tool of assistantTools) {
      const schema = tool.jsonSchema as { properties?: Record<string, unknown>; required?: string[] }
      const props = Object.keys(schema.properties ?? {})
      // An empty object must fail validation iff the tool has required props
      const emptyOk = tool.input.safeParse({}).success
      expect(emptyOk, `${tool.name}: empty input`).toBe((schema.required ?? []).length === 0)
      // Every JSON property should be accepted by Zod (no silent drops)
      for (const p of props) {
        const shape = (tool.input as unknown as { shape?: Record<string, unknown> }).shape
        expect(shape && p in shape, `${tool.name}: ${p} missing from Zod schema`).toBe(true)
      }
    }
  })

  it("rejects an unknown tool without throwing", async () => {
    const result = await runTool("launch_rockets", {}, ctx)
    expect(result.ok).toBe(false)
    expect(result.text).toMatch(/Unknown tool/)
  })

  it("reports invalid input in a way the model can read", async () => {
    const result = await runTool("update_schedule", { workerId: "w", date: "March 2nd", shiftType: "DAY" }, ctx)
    expect(result.ok).toBe(false)
    expect(result.text).toMatch(/date: Use YYYY-MM-DD/)
  })
})

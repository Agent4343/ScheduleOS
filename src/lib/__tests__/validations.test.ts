import { describe, it, expect } from "vitest"
import {
  loginSchema,
  registerSchema,
  createCrewSchema,
  createScheduleSchema,
  createTimeOffRequestSchema,
  createHolidaySchema,
  createStaffingRuleSchema,
  createRotationPatternSchema,
} from "../validations"

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "pass" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-email", password: "pass" })
    expect(result.success).toBe(false)
  })

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@test.com", password: "" })
    expect(result.success).toBe(false)
  })
})

describe("registerSchema", () => {
  const validData = {
    email: "user@test.com",
    password: "SecurePass123!",
    name: "John Doe",
  }

  it("accepts valid registration", () => {
    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it("rejects short password", () => {
    const result = registerSchema.safeParse({ ...validData, password: "Short1!" })
    expect(result.success).toBe(false)
  })

  it("rejects password without uppercase", () => {
    const result = registerSchema.safeParse({ ...validData, password: "alllowercase123!" })
    expect(result.success).toBe(false)
  })

  it("rejects password without special character", () => {
    const result = registerSchema.safeParse({ ...validData, password: "NoSpecialChar123" })
    expect(result.success).toBe(false)
  })

  it("rejects name with special characters", () => {
    const result = registerSchema.safeParse({ ...validData, name: "<script>alert(1)</script>" })
    expect(result.success).toBe(false)
  })

  it("rejects name that is too short", () => {
    const result = registerSchema.safeParse({ ...validData, name: "A" })
    expect(result.success).toBe(false)
  })

  it("accepts optional organizationName", () => {
    const result = registerSchema.safeParse({ ...validData, organizationName: "ACME Corp" })
    expect(result.success).toBe(true)
  })

  it("rejects organizationName with special characters", () => {
    const result = registerSchema.safeParse({ ...validData, organizationName: "<div>hack</div>" })
    expect(result.success).toBe(false)
  })
})

describe("createCrewSchema", () => {
  it("accepts valid crew", () => {
    const result = createCrewSchema.safeParse({ name: "Crew A", color: "#ff0000" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid color format", () => {
    const result = createCrewSchema.safeParse({ name: "Crew A", color: "red" })
    expect(result.success).toBe(false)
  })

  it("rejects crew name with HTML", () => {
    const result = createCrewSchema.safeParse({ name: "<b>Crew</b>", color: "#ff0000" })
    expect(result.success).toBe(false)
  })
})

describe("createRotationPatternSchema", () => {
  it("accepts valid 14/14 pattern", () => {
    const result = createRotationPatternSchema.safeParse({
      name: "14/14 Standard",
      daysOn: 14,
      daysOff: 14,
    })
    expect(result.success).toBe(true)
  })

  it("rejects daysOn > 60", () => {
    const result = createRotationPatternSchema.safeParse({
      name: "Too long",
      daysOn: 100,
      daysOff: 14,
    })
    expect(result.success).toBe(false)
  })

  it("rejects daysOn = 0", () => {
    const result = createRotationPatternSchema.safeParse({
      name: "Zero days",
      daysOn: 0,
      daysOff: 14,
    })
    expect(result.success).toBe(false)
  })
})

describe("createScheduleSchema", () => {
  it("accepts valid schedule entry", () => {
    const result = createScheduleSchema.safeParse({
      userId: "user-123",
      date: "2026-03-01",
      shiftType: "DAY",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid shift type", () => {
    const result = createScheduleSchema.safeParse({
      userId: "user-123",
      date: "2026-03-01",
      shiftType: "INVALID",
    })
    expect(result.success).toBe(false)
  })
})

describe("createTimeOffRequestSchema", () => {
  it("accepts valid time off request", () => {
    const result = createTimeOffRequestSchema.safeParse({
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      type: "VACATION",
    })
    expect(result.success).toBe(true)
  })

  it("rejects endDate before startDate", () => {
    const result = createTimeOffRequestSchema.safeParse({
      startDate: "2026-03-05",
      endDate: "2026-03-01",
      type: "VACATION",
    })
    expect(result.success).toBe(false)
  })
})

describe("createHolidaySchema", () => {
  it("accepts valid holiday", () => {
    const result = createHolidaySchema.safeParse({
      name: "Christmas",
      date: "2026-12-25",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing name", () => {
    const result = createHolidaySchema.safeParse({
      name: "",
      date: "2026-12-25",
    })
    expect(result.success).toBe(false)
  })
})

describe("createStaffingRuleSchema", () => {
  it("accepts valid staffing rule", () => {
    const result = createStaffingRuleSchema.safeParse({
      name: "Min Day Staff",
      shiftType: "DAY",
      minWorkers: 3,
    })
    expect(result.success).toBe(true)
  })

  it("rejects negative minWorkers", () => {
    const result = createStaffingRuleSchema.safeParse({
      name: "Bad Rule",
      shiftType: "DAY",
      minWorkers: -1,
    })
    expect(result.success).toBe(false)
  })
})

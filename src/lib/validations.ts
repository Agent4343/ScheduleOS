import { z } from "zod"
import { UserRole, UserStatus, TimeOffType, ShiftType } from "@prisma/client"
import { PositionType } from "@/types"

// Auth validations
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .regex(/^[a-zA-Z\s\-'.]+$/, "Name contains invalid characters"),
  organizationName: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,']+$/, "Organization name contains invalid characters")
    .optional(),
})

// Organization validations

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")

/**
 * Every organization setting an admin may edit through the API.
 *
 * Deliberately no defaults: this schema is used for PATCH, and a default
 * would silently overwrite a stored value whenever the client omits a key.
 * Unknown keys are stripped, which is what keeps billing fields
 * (see PROTECTED_ORGANIZATION_SETTINGS) out of reach of this endpoint.
 */
export const organizationSettingsSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  dateFormat: z.string().max(32).optional(),
  minStaffingAlertEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  smsNotificationsEnabled: z.boolean().optional(),
  autoCheckoutEnabled: z.boolean().optional(),
  autoCheckoutHours: z.number().int().min(1).max(24).optional(),
  minStaffOperators: z.number().int().min(0).max(1000).optional(),
  minStaffOnshoreControlRoom: z.number().int().min(0).max(1000).optional(),
  shiftColors: z
    .record(z.string().max(32), z.object({ bg: hexColor, text: hexColor }))
    .optional(),
})

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>

/**
 * Settings keys written by the Stripe webhook. They are never accepted from
 * a user request and are always carried over from the stored value.
 */
export const PROTECTED_ORGANIZATION_SETTINGS = [
  "plan",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "subscriptionStatus",
] as const

export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,']+$/, "Organization name contains invalid characters"),
  settings: organizationSettingsSchema.optional(),
})

export const updateOrganizationSchema = createOrganizationSchema.partial()

// User validations

// Fields shared by create and update, with no defaults. Defaults live only on
// the create schema: Zod's .partial() keeps .default(), so deriving the update
// schema from the create schema would reset role/status/positionType on every
// PATCH that omitted them.
const userFieldsSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .regex(/^[a-zA-Z\s\-'.]+$/, "Name contains invalid characters"),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  position: z.string()
    .max(100, "Position must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_.,'&/()]+$/, "Position contains invalid characters")
    .optional(),
  positionType: z.nativeEnum(PositionType),
  phone: z.string().optional(),
  // null clears the crew on update
  crewId: z.string().nullable().optional(),
  hireDate: z.coerce.date().optional(),
  // Role-based coverage
  positionGroupId: z.string().nullable().optional(),
  rosterOrder: z.number().int().min(0).max(9999).nullable().optional(),
  qualifications: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
})

export const createUserSchema = userFieldsSchema.extend({
  role: z.nativeEnum(UserRole).default(UserRole.WORKER),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  positionType: z.nativeEnum(PositionType).default(PositionType.OTHER),
  password: z.string().min(8).optional(),
})

// Password changes go through /api/auth/change-password; never through a
// general update, where the value would end up in the audit log.
export const updateUserSchema = userFieldsSchema.partial()

// Crew validations
export const createCrewSchema = z.object({
  name: z.string()
    .min(1, "Crew name is required")
    .max(50, "Crew name must be at most 50 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Crew name contains invalid characters"),
  description: z.string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  rotationPatternId: z.string().optional(),
})

export const updateCrewSchema = createCrewSchema.partial().extend({
  // null or "" clears the pattern; omitted leaves it alone
  rotationPatternId: z.string().nullable().optional(),
  // Display-only phase for crews that have not been anchored yet
  currentPhase: z.number().int().min(0).optional(),
})

// Rotation pattern validations
export const createRotationPatternSchema = z.object({
  name: z.string().min(1, "Pattern name is required").max(100),
  description: z.string().max(500).optional(),
  daysOn: z.number().int().min(1).max(60),
  daysOff: z.number().int().min(1).max(60),
  includesNights: z.boolean().default(false),
  nightsAtStart: z.boolean().default(true),
  nightDays: z.number().int().min(0).max(60).default(0),
  alternatesShifts: z.boolean().default(false),
  isDefault: z.boolean().default(false),
})

export const updateRotationPatternSchema = createRotationPatternSchema.partial()

// Schedule validations
export const createScheduleSchema = z.object({
  userId: z.string(),
  date: z.coerce.date(),
  shiftType: z.nativeEnum(ShiftType),
  customShiftCode: z.string().nullish(),
  // Omitted means "this is a manual edit" → the route defaults it to true
  isOverride: z.boolean().optional(),
  overrideReason: z.string().nullish(),
  notes: z.string().nullish(),
})

export const updateScheduleSchema = createScheduleSchema.partial().omit({ userId: true, date: true })

/** POST /api/schedules/bulk — one shift for every day in a range */
export const bulkScheduleSchema = z
  .object({
    userId: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    shiftType: z.nativeEnum(ShiftType),
    customShiftCode: z.string().max(32).nullish(),
    overrideReason: z.string().max(500).nullish(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date must be on or after start date", path: ["endDate"] })

export const generateScheduleSchema = z.object({
  userId: z.string().optional(),
  crewId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  patternId: z.string(),
  /** Day-in-cycle on startDate. Ignored when the crew already has an anchor. */
  startPhase: z.number().int().min(0).optional(),
  /** Shift of the first working block. Ignored when the crew already has an anchor. */
  startingShift: z.enum(["DAY", "NIGHT"]).optional(),
  clearOverrides: z.boolean().default(false),
  /** Re-anchor the crew at startDate using startPhase/startingShift. */
  resetAnchor: z.boolean().default(false),
})

// Time off request validations
export const createTimeOffRequestSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  type: z.nativeEnum(TimeOffType),
  reason: z.string().max(1000).optional(),
}).refine(data => data.endDate >= data.startDate, {
  message: "End date must be on or after start date",
  path: ["endDate"],
})

export const updateTimeOffRequestSchema = z.object({
  status: z.enum(["APPROVED", "DENIED"]),
  adminNotes: z.string().max(1000).optional(),
})

// Staffing rule validations
export const createStaffingRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  shiftType: z.nativeEnum(ShiftType),
  minWorkers: z.number().int().min(0),
  maxVacation: z.number().int().min(0).default(1),
  role: z.nativeEnum(UserRole).optional().nullable(),
  positionType: z.nativeEnum(PositionType).optional().nullable(),
  crewId: z.string().optional().nullable(),
  priority: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateStaffingRuleSchema = createStaffingRuleSchema.partial()

// Shutdown validations
const shutdownBaseSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  description: z.string().max(500).optional(),
})

export const createShutdownSchema = shutdownBaseSchema.refine(
  data => data.endDate >= data.startDate,
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
)

export const updateShutdownSchema = shutdownBaseSchema.partial()

// Holiday validations
export const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.coerce.date(),
  isRecurring: z.boolean().default(true),
})

// Invitation validations
export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(UserRole).default(UserRole.WORKER),
})

// Excel import validations
export const importUsersSchema = z.array(z.object({
  email: z.string().email(),
  name: z.string().min(1),
  position: z.string().optional(),
  crewName: z.string().optional(),
  hireDate: z.coerce.date().optional(),
}))

// Type exports
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type CreateCrewInput = z.infer<typeof createCrewSchema>
export type CreateRotationPatternInput = z.infer<typeof createRotationPatternSchema>
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type GenerateScheduleInput = z.infer<typeof generateScheduleSchema>
export type CreateTimeOffRequestInput = z.infer<typeof createTimeOffRequestSchema>
export type CreateStaffingRuleInput = z.infer<typeof createStaffingRuleSchema>
export type CreateShutdownInput = z.infer<typeof createShutdownSchema>
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>

// Role-based coverage validations
export const coverageRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    sortOrder: z.number().int().min(0).max(999).default(0),
    minDay: z.number().int().min(0).max(999).default(1),
    targetDay: z.number().int().min(0).max(999).default(1),
    minNight: z.number().int().min(0).max(999).default(0),
    targetNight: z.number().int().min(0).max(999).default(0),
    requiredQualification: z.string().trim().max(32).nullable().optional(),
  })
  .refine((r) => r.targetDay >= r.minDay && r.targetNight >= r.minNight, {
    message: "Target must be at least the minimum",
  })
export const updateCoverageRoleSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  minDay: z.number().int().min(0).max(999).optional(),
  targetDay: z.number().int().min(0).max(999).optional(),
  minNight: z.number().int().min(0).max(999).optional(),
  targetNight: z.number().int().min(0).max(999).optional(),
  requiredQualification: z.string().trim().max(32).nullable().optional(),
})

export const positionGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(999).default(0),
  color: hexColor.nullable().optional(),
  defaultCoverageRoleId: z.string().nullable().optional(),
})
export const updatePositionGroupSchema = positionGroupSchema.partial()

export const coverageShiftSchema = z.enum(["DAY", "NIGHT"])

/** A sign-off definition: Utilities Operator, Oil Operator, Control Room… */
export const qualificationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1).max(60),
  color: hexColor.nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
})
export const updateQualificationSchema = qualificationSchema.partial()

/**
 * The complete set of sign-off requirements for one role, sent as a whole so
 * the editor can add, change and remove in a single save.
 */
export const coverageRequirementsSchema = z.object({
  requirements: z
    .array(
      z.object({
        qualificationId: z.string().min(1),
        countDay: z.number().int().min(0).max(99).default(1),
        countNight: z.number().int().min(0).max(99).default(1),
      })
    )
    .max(20)
    .refine((rs) => new Set(rs.map((r) => r.qualificationId)).size === rs.length, {
      message: "Each sign-off can only be listed once per role",
    }),
})

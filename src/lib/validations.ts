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
    .regex(/^[a-zA-Z\s\-'.*]+$/, "Name contains invalid characters"),
  organizationName: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,']+$/, "Organization name contains invalid characters"),
})

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  )

// Organization validations
export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_&.,']+$/, "Organization name contains invalid characters"),
  settings: z.object({
    timezone: z.string().default("America/St_Johns"),
    weekStartsOn: z.number().min(0).max(6).default(0),
    minStaffingAlertEnabled: z.boolean().default(true),
    emailNotificationsEnabled: z.boolean().default(true),
    smsNotificationsEnabled: z.boolean().default(false),
  }).optional(),
})

export const updateOrganizationSchema = createOrganizationSchema.partial()

// User validations
export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .regex(/^[a-zA-Z\s\-'.*]+$/, "Name contains invalid characters"),
  role: z.nativeEnum(UserRole).default(UserRole.WORKER),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  position: z.string()
    .max(100, "Position must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_.,'&/()]+$/, "Position contains invalid characters")
    .nullish(),
  positionType: z.nativeEnum(PositionType).default(PositionType.OTHER),
  phone: z.string().nullish(),
  crewId: z.string().nullish(),
  departmentId: z.string().nullish(),
  customRoleId: z.string().nullish(),
  hireDate: z.coerce.date().nullish(),
  password: z.string().min(8).optional(),
  isControlRoomTrained: z.boolean().default(false),
  isOilOperatorTrained: z.boolean().default(false),
  isUtilityOperatorTrained: z.boolean().default(false),
  isGasOperatorTrained: z.boolean().default(false),
  includeInStaffingCount: z.boolean().default(true),
  singleTrainingCoverageOnly: z.boolean().default(false),
})

// For updates, all fields are optional including email and name
export const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").nullish(),
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .regex(/^[a-zA-Z\s\-'.*]+$/, "Name contains invalid characters")
    .nullish(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  position: z.string()
    .max(100, "Position must be at most 100 characters")
    .regex(/^[a-zA-Z0-9\s\-_.,'&/()]+$/, "Position contains invalid characters")
    .nullish(),
  positionType: z.nativeEnum(PositionType).optional(),
  phone: z.string().nullish(),
  crewId: z.string().nullish(),
  departmentId: z.string().nullish(),
  customRoleId: z.string().nullish(),
  hireDate: z.coerce.date().nullish(),
  isControlRoomTrained: z.boolean().optional(),
  isOilOperatorTrained: z.boolean().optional(),
  isUtilityOperatorTrained: z.boolean().optional(),
  isGasOperatorTrained: z.boolean().optional(),
  includeInStaffingCount: z.boolean().optional(),
  singleTrainingCoverageOnly: z.boolean().optional(),
})

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
  departmentId: z.string().nullish(),
})

export const updateCrewSchema = createCrewSchema.partial()

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
  isOverride: z.boolean().default(false),
  overrideReason: z.string().nullish(),
  notes: z.string().nullish(),
})

export const updateScheduleSchema = createScheduleSchema.partial().omit({ userId: true, date: true })

export const generateScheduleSchema = z.object({
  userId: z.string().optional(),
  crewId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  patternId: z.string(),
  startPhase: z.number().int().min(0).optional(),
  startingShift: z.enum(["DAY", "NIGHT"]).optional(),
  clearOverrides: z.boolean().default(false),
  replaceExisting: z.boolean().default(true),
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

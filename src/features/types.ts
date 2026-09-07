/**
 * Shapes the API returns to the browser. Kept in one place so pages stop
 * redeclaring slightly different `interface Crew` / `interface User` copies.
 * Dates arrive as ISO strings; use src/lib/dates.ts to display them.
 */

export type UserRole = "ADMIN" | "SUPERVISOR" | "WORKER"
export type UserStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED"
export type PositionType = "OPERATOR" | "ONSHORE_CONTROL_ROOM" | "OTHER"
export type ShiftType =
  | "DAY" | "NIGHT" | "OFF" | "LEAVE" | "PL_DAY" | "PL_NIGHT"
  | "VACATION" | "SICK" | "TRAINING" | "SHUTDOWN" | "CUSTOM"

export interface CrewRef {
  id: string
  name: string
  color: string
}

export interface RotationPattern {
  id: string
  name: string
  description: string | null
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightsAtStart: boolean
  nightDays: number
  alternatesShifts: boolean
  isDefault: boolean
  _count?: { crews: number }
}

export interface Crew extends CrewRef {
  description: string | null
  /** Derived from the rotation anchor when one is set (display only). */
  currentPhase: number
  rotationAnchorDate: string | null
  anchorPhase: number
  anchorStartingShift: "DAY" | "NIGHT" | null
  rotationPattern: Pick<RotationPattern, "id" | "name" | "daysOn" | "daysOff" | "includesNights"> | null
  _count: { workers: number }
}

export interface Worker {
  id: string
  email: string
  name: string | null
  role: UserRole
  position: string | null
  positionType?: PositionType
  phone: string | null
  status: UserStatus
  hireDate: string | null
  createdAt?: string
  crew: CrewRef | null
}

export interface Schedule {
  id: string
  date: string
  shiftType: ShiftType
  customShiftCode: string | null
  isOverride: boolean
  overrideReason: string | null
  notes: string | null
  userId: string
  crewId: string | null
  user?: { id: string; name: string | null; email?: string; crewId?: string | null }
}

export interface OrganizationSettings {
  timezone?: string
  weekStartsOn?: number
  dateFormat?: string
  minStaffingAlertEnabled?: boolean
  emailNotificationsEnabled?: boolean
  smsNotificationsEnabled?: boolean
  autoCheckoutEnabled?: boolean
  autoCheckoutHours?: number
  minStaffOperators?: number
  minStaffOnshoreControlRoom?: number
  shiftColors?: Record<string, { bg: string; text: string }>
  plan?: string
  subscriptionStatus?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  settings: OrganizationSettings
  _count?: { users: number; crews: number; rotationPatterns: number }
}

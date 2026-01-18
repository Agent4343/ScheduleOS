// Local enum definitions (matching Prisma schema)
// These are defined locally to avoid build issues when Prisma client isn't generated

export const UserRole = {
  ADMIN: 'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  WORKER: 'WORKER',
} as const
export type UserRole = typeof UserRole[keyof typeof UserRole]

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
} as const
export type UserStatus = typeof UserStatus[keyof typeof UserStatus]

export const ShiftType = {
  DAY: 'DAY',
  NIGHT: 'NIGHT',
  OFF: 'OFF',
  LEAVE: 'LEAVE',
  PL_DAY: 'PL_DAY',
  PL_NIGHT: 'PL_NIGHT',
  VACATION: 'VACATION',
  SICK: 'SICK',
  TRAINING: 'TRAINING',
  SHUTDOWN: 'SHUTDOWN',
  CUSTOM: 'CUSTOM',
} as const
export type ShiftType = typeof ShiftType[keyof typeof ShiftType]

export const TimeOffType = {
  VACATION: 'VACATION',
  SICK: 'SICK',
  PERSONAL: 'PERSONAL',
  BEREAVEMENT: 'BEREAVEMENT',
  JURY_DUTY: 'JURY_DUTY',
  OTHER: 'OTHER',
} as const
export type TimeOffType = typeof TimeOffType[keyof typeof TimeOffType]

export const RequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  CANCELLED: 'CANCELLED',
} as const
export type RequestStatus = typeof RequestStatus[keyof typeof RequestStatus]

export const NotificationType = {
  SCHEDULE_CHANGE: 'SCHEDULE_CHANGE',
  TIME_OFF_REQUEST: 'TIME_OFF_REQUEST',
  TIME_OFF_APPROVED: 'TIME_OFF_APPROVED',
  TIME_OFF_DENIED: 'TIME_OFF_DENIED',
  STAFFING_ALERT: 'STAFFING_ALERT',
  SHIFT_SWAP: 'SHIFT_SWAP',
  SYSTEM: 'SYSTEM',
} as const
export type NotificationType = typeof NotificationType[keyof typeof NotificationType]

// Extended types for frontend use
export interface OrganizationSettings {
  timezone: string
  weekStartsOn: number // 0 = Sunday, 1 = Monday
  defaultShiftPatterns: string[]
  minStaffingAlertEnabled: boolean
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
}

export interface PatternDay {
  dayIndex: number
  shiftType: ShiftType
}

export interface RotationPatternDefinition {
  totalDays: number
  pattern: PatternDay[]
}

export interface ScheduleGenerationOptions {
  userId: string
  crewId: string
  patternId: string
  startDate: Date
  endDate: Date
  startPhase?: number
}

export interface StaffingGap {
  date: Date
  shiftType: ShiftType
  required: number
  actual: number
  shortage: number
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  schedules: ScheduleEntry[]
}

export interface ScheduleEntry {
  id: string
  userId: string
  userName: string
  crewId: string | null
  crewName: string | null
  crewColor: string
  shiftType: ShiftType
  isOverride: boolean
}

export interface DashboardStats {
  totalWorkers: number
  activeCrews: number
  onDutyToday: number
  pendingRequests: number
  upcomingShutdowns: number
  staffingGaps: number
}

export interface TimeOffRequestWithUser {
  id: string
  startDate: Date
  endDate: Date
  type: TimeOffType
  status: RequestStatus
  reason: string | null
  user: {
    id: string
    name: string | null
    email: string
    crew: {
      id: string
      name: string
    } | null
  }
  createdAt: Date
}

export interface UserWithCrew {
  id: string
  email: string
  name: string | null
  role: UserRole
  position: string | null
  status: UserStatus
  hireDate: Date | null
  crew: {
    id: string
    name: string
    color: string
  } | null
}

export interface CrewWithDetails {
  id: string
  name: string
  description: string | null
  color: string
  currentPhase: number
  rotationPattern: {
    id: string
    name: string
    daysOn: number
    daysOff: number
  } | null
  _count: {
    workers: number
  }
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Form types
export interface CreateUserForm {
  email: string
  name: string
  role: UserRole
  position?: string
  crewId?: string
  hireDate?: Date
}

export interface CreateCrewForm {
  name: string
  description?: string
  color: string
  rotationPatternId?: string
}

export interface CreateRotationPatternForm {
  name: string
  description?: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightsAtStart?: boolean
  nightDays?: number
}

export interface TimeOffRequestForm {
  startDate: Date
  endDate: Date
  type: TimeOffType
  reason?: string
}

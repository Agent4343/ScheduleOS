import { UserRole, UserStatus, ShiftType, TimeOffType, RequestStatus, NotificationType } from '@prisma/client'

// Re-export Prisma enums
export { UserRole, UserStatus, ShiftType, TimeOffType, RequestStatus, NotificationType }

// Position types for categorizing workers
export enum PositionType {
  OPERATOR = 'OPERATOR',
  ONSHORE_CONTROL_ROOM = 'ONSHORE_CONTROL_ROOM',
  OTHER = 'OTHER'
}

// Extended types for frontend use
export interface OrganizationSettings {
  timezone: string
  weekStartsOn: number // 0 = Sunday, 1 = Monday
  defaultShiftPatterns: string[]
  minStaffingAlertEnabled: boolean
  emailNotificationsEnabled: boolean
  smsNotificationsEnabled: boolean
  // Minimum staff requirements by position type
  minStaffOperators?: number
  minStaffOnshoreControlRoom?: number
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
  positionType: PositionType
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
  positionType?: PositionType
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

import { UserRole, UserStatus, ShiftType, TimeOffType, RequestStatus, NotificationType } from '@prisma/client'

// Re-export Prisma enums
export { UserRole, UserStatus, ShiftType, TimeOffType, RequestStatus, NotificationType }

// Shift type display mappings for offshore operations
export const SHIFT_DISPLAY: Record<ShiftType, { code: string; label: string; category: string }> = {
  DAY: { code: 'D', label: 'Day Shift', category: 'Field Ops' },
  NIGHT: { code: 'N', label: 'Night Shift', category: 'Field Ops' },
  OCR_DAY: { code: 'OCR-D', label: 'Operations Control Room Day', category: 'Control Room' },
  OCR_NIGHT: { code: 'OCR-N', label: 'Operations Control Room Night', category: 'Control Room' },
  CCR_DAY: { code: 'CCR-D', label: 'Central Control Room Day', category: 'Control Room' },
  CCR_NIGHT: { code: 'CCR-N', label: 'Central Control Room Night', category: 'Control Room' },
  PS: { code: 'PS', label: 'Production Supervisor (Acting)', category: 'Backfill' },
  PL_DAY: { code: 'PL-D', label: 'Production Lead Day (Acting)', category: 'Backfill' },
  PL_NIGHT: { code: 'PL-N', label: 'Production Lead Night (Acting)', category: 'Backfill' },
  TRAINING: { code: 'TR', label: 'Training', category: 'Non-operational' },
  OSCC: { code: 'OSCC', label: 'Offshore Safety Course', category: 'Non-operational' },
  OFF: { code: '', label: 'Off Rotation', category: 'Off' },
  LEAVE: { code: 'L', label: 'Leave', category: 'Absence' },
  SICK: { code: 'SL', label: 'Sick Leave', category: 'Absence' },
  VACATION: { code: 'V', label: 'Vacation', category: 'Absence' },
  SHUTDOWN: { code: 'X', label: 'Shutdown', category: 'Other' },
}

// Qualification types
export type QualificationType = 'CCR' | 'PS_CAPABLE' | 'PL_CAPABLE'

export const QUALIFICATION_LABELS: Record<QualificationType, string> = {
  CCR: 'CCR Trained',
  PS_CAPABLE: 'PS Capable',
  PL_CAPABLE: 'PL Capable',
}

// Rotation group codes
export type RotationGroupCode = '151' | '351' | '352' | '451' | 'OCR'

export const ROTATION_GROUPS: Record<RotationGroupCode, { name: string; daysOn: number; daysOff: number; alternates: boolean }> = {
  '151': { name: 'Primary 21/21', daysOn: 21, daysOff: 21, alternates: false },
  '351': { name: 'Alternating 21/21 (Group 1)', daysOn: 21, daysOff: 21, alternates: true },
  '352': { name: 'Alternating 21/21 (Group 2)', daysOn: 21, daysOff: 21, alternates: true },
  '451': { name: 'Alternating 21/21 (Group 3)', daysOn: 21, daysOff: 21, alternates: true },
  'OCR': { name: 'Control Room 14/14', daysOn: 14, daysOff: 14, alternates: false },
}

// Primary positions
export type PrimaryPositionType = 'OIM' | 'PRODUCTION_SUPERVISOR' | 'PRODUCTION_LEAD' | 'OCR_OPERATOR' | 'OPS_TECH'

export const PRIMARY_POSITIONS: Record<PrimaryPositionType, string> = {
  OIM: 'OIM',
  PRODUCTION_SUPERVISOR: 'Production Supervisor',
  PRODUCTION_LEAD: 'Production Lead',
  OCR_OPERATOR: 'OCR Operator',
  OPS_TECH: 'Ops Tech',
}

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
  // Offshore specific
  rotationGroup: string | null
  primaryPosition: string | null
  isCCRQualified: boolean
  isPSCapable: boolean
  isPLCapable: boolean
  qualifications: string[]
  crew: {
    id: string
    name: string
    color: string
    code: string | null
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

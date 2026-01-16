export interface Organization {
  id: string
  name: string
  slug: string
  settings: {
    timezone?: string
    weekStartsOn?: number
    minStaffingAlertEnabled?: boolean
    emailNotificationsEnabled?: boolean
    smsNotificationsEnabled?: boolean
  }
  _count: {
    users: number
    crews: number
    rotationPatterns: number
  }
}

export interface RotationPattern {
  id: string
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  isDefault: boolean
  _count: {
    crews: number
  }
}

export interface Position {
  id: string
  name: string
  code: string | null
  category: string | null
  shiftType: string
  minStaffing: number
  maxStaffing: number
  sortOrder: number
}

export interface NewPatternForm {
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
}

export interface PositionForm {
  name: string
  code: string
  category: string
  shiftType: string
  minStaffing: number
  maxStaffing: number
  sortOrder: number
}

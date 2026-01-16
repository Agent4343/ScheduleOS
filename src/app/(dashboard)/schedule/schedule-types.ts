import { ShiftType, UserRole } from "@/types"

export interface Schedule {
  id: string
  date: string
  shiftType: ShiftType
  user: {
    id: string
    name: string
    position: string | null
  }
  crew: {
    id: string
    name: string
    color: string
  } | null
}

export interface Crew {
  id: string
  name: string
  color: string
}

export interface Worker {
  id: string
  name: string | null
  email?: string
  position: string | null
  phone?: string | null
  role?: UserRole
  hireDate?: string | null
  crew: {
    id: string
    name: string
    color: string
  } | null
}

export interface WorkerEditForm {
  name: string
  position: string
  phone: string
  crewId: string
  role: UserRole
  hireDate: string
}

export interface RotationPattern {
  id: string
  name: string
  daysOn: number
  daysOff: number
  includesNights: boolean
  nightDays: number
}

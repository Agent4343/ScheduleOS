import { apiGet, apiSend, qs } from "@/lib/api-client"
import type { Schedule, ShiftType } from "@/features/types"

export interface ScheduleQuery {
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD */
  endDate: string
  crewId?: string
  userId?: string
}

export interface SetShiftInput {
  userId: string
  /** YYYY-MM-DD */
  date: string
  shiftType: ShiftType
  customShiftCode?: string | null
  overrideReason?: string | null
  notes?: string | null
}

export interface GenerateScheduleInput {
  patternId: string
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD */
  endDate: string
  crewId?: string
  userId?: string
  /** Only used when the crew has no anchor yet (or resetAnchor is true) */
  startPhase?: number
  startingShift?: "DAY" | "NIGHT"
  clearOverrides?: boolean
  resetAnchor?: boolean
}

export interface GenerateScheduleResult {
  usersProcessed: number
  daysGenerated: number
  totalRecords: number
  deletedRecords: number
  timeOffReapplied: number
  anchor: { date: string; phase: number; startingShift: "DAY" | "NIGHT"; source: "crew" | "request"; savedToCrew: boolean }
}

export const schedulesApi = {
  list: (query: ScheduleQuery) => apiGet<Schedule[]>(`/api/schedules${qs(query)}`),
  setShift: (input: SetShiftInput) => apiSend<Schedule>("POST", "/api/schedules", input),
  generate: (input: GenerateScheduleInput) =>
    apiSend<GenerateScheduleResult>("POST", "/api/schedules", input),
}

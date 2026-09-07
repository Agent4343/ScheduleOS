import { apiGet, apiSend, qs } from "@/lib/api-client"
import type { PositionType, UserRole, UserStatus, Worker } from "@/features/types"

export interface WorkerFilters {
  crewId?: string
  status?: UserStatus
  role?: UserRole
}

export interface CreateWorkerInput {
  email: string
  name: string
  role?: UserRole
  position?: string
  positionType?: PositionType
  phone?: string
  crewId?: string
  /** YYYY-MM-DD */
  hireDate?: string
  password?: string
  positionGroupId?: string | null
  rosterOrder?: number | null
  qualifications?: string[]
}

export type UpdateWorkerInput = Partial<Omit<CreateWorkerInput, "password" | "crewId">> & {
  status?: UserStatus
  /** null clears the crew */
  crewId?: string | null
}

export const workersApi = {
  list: (filters: WorkerFilters = {}) => apiGet<Worker[]>(`/api/users${qs(filters)}`),
  get: (id: string) => apiGet<Worker>(`/api/users/${id}`),
  create: (input: CreateWorkerInput) => apiSend<Worker>("POST", "/api/users", input),
  update: (id: string, input: UpdateWorkerInput) => apiSend<Worker>("PATCH", `/api/users/${id}`, input),
  remove: (id: string) => apiSend<null>("DELETE", `/api/users/${id}`),
}

import { apiGet, apiSend } from "@/lib/api-client"
import type { Crew } from "@/features/types"

export interface CreateCrewInput {
  name: string
  description?: string
  color: string
  rotationPatternId?: string
}

export interface UpdateCrewInput {
  name?: string
  description?: string | null
  color?: string
  /** null clears the pattern (and the rotation anchor) */
  rotationPatternId?: string | null
  currentPhase?: number
}

export const crewsApi = {
  list: () => apiGet<Crew[]>("/api/crews"),
  get: (id: string) => apiGet<Crew>(`/api/crews/${id}`),
  create: (input: CreateCrewInput) => apiSend<Crew>("POST", "/api/crews", input),
  update: (id: string, input: UpdateCrewInput) => apiSend<Crew>("PATCH", `/api/crews/${id}`, input),
  remove: (id: string) => apiSend<null>("DELETE", `/api/crews/${id}`),
}

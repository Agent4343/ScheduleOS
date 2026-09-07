import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"

export interface SetupStatus {
  hasCrews: boolean
  hasWorkers: boolean
  hasPatterns: boolean
  hasSchedules: boolean
  crewCount: number
  workerCount: number
  patternCount: number
  completedSteps: number
  totalSteps: number
  isComplete: boolean
}

export const setupStatusKeys = { all: ["setup-status"] as const }

export function useSetupStatus() {
  return useQuery({
    queryKey: setupStatusKeys.all,
    queryFn: () => apiGet<SetupStatus>("/api/setup-status"),
    staleTime: 0,
  })
}

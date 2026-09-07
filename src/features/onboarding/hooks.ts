import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"

export interface SetupStatus {
  hasWorkers: boolean
  hasCoverage: boolean
  hasGroupedWorkers: boolean
  hasSignOffs: boolean
  hasSchedules: boolean
  hasCrews: boolean
  hasPatterns: boolean
  crewCount: number
  workerCount: number
  patternCount: number
  scheduleCount: number
  coverageRoleCount: number
  positionGroupCount: number
  qualificationCount: number
  groupedWorkerCount: number
  signedOffWorkerCount: number
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

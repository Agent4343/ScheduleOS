import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { schedulesApi, type GenerateScheduleInput, type ScheduleQuery, type SetShiftInput } from "./api"

export const scheduleKeys = {
  all: ["schedules"] as const,
  range: (q: ScheduleQuery) =>
    ["schedules", q.startDate, q.endDate, q.crewId ?? "all", q.userId ?? "all"] as const,
}

/**
 * Schedules for a date range. Keyed by the full query, so switching year or
 * crew never lets a slow earlier response overwrite a newer one.
 */
export function useSchedules(query: ScheduleQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: scheduleKeys.range(query),
    queryFn: () => schedulesApi.list(query),
    enabled: options?.enabled ?? true,
  })
}

export function useSetShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetShiftInput) => schedulesApi.setShift(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.all }),
  })
}

export function useGenerateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateScheduleInput) => schedulesApi.generate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.all })
      // Generation may have anchored the crew (currentPhase is derived from it)
      qc.invalidateQueries({ queryKey: ["crews"] })
    },
  })
}

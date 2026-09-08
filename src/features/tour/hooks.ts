import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend } from "@/lib/api-client"

interface TourState {
  hasSeenWelcome: boolean
  role: "ADMIN" | "SUPERVISOR" | "WORKER"
}

export const tourKeys = { all: ["welcome-tour"] as const }

export function useTourState() {
  return useQuery({
    queryKey: tourKeys.all,
    queryFn: () => apiGet<TourState>("/api/me/tour"),
    // It only changes once, so do not keep asking
    staleTime: Infinity,
    retry: false,
  })
}

/** Marks it played, whether they watched it through or skipped. */
export function useMarkTourSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiSend<null>("POST", "/api/me/tour"),
    onSuccess: () => qc.invalidateQueries({ queryKey: tourKeys.all }),
  })
}

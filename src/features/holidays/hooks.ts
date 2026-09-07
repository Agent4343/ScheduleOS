import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend } from "@/lib/api-client"

export interface Holiday {
  id: string
  name: string
  date: string
  isRecurring: boolean
}

export const holidayKeys = { all: ["holidays"] as const }

export function useHolidays() {
  return useQuery({ queryKey: holidayKeys.all, queryFn: () => apiGet<Holiday[]>("/api/holidays") })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; date: string; recurring: boolean }) =>
      apiSend<Holiday>("POST", "/api/holidays", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: holidayKeys.all }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/api/holidays/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: holidayKeys.all }),
  })
}

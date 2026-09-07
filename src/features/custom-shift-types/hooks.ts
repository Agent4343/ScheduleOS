import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"

export interface CustomShiftType {
  id: string
  code: string
  name: string
  color: string
  textColor: string
  description: string | null
  isActive: boolean
  coverageShift?: "DAY" | "NIGHT" | null
  coverageRoleId?: string | null
  isBackfill?: boolean
}

export const customShiftTypeKeys = { all: ["custom-shift-types"] as const }

export function useCustomShiftTypes() {
  return useQuery({
    queryKey: customShiftTypeKeys.all,
    queryFn: () => apiGet<CustomShiftType[]>("/api/custom-shift-types"),
  })
}

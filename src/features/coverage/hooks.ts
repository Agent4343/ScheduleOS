import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend, qs } from "@/lib/api-client"

export type CoverageShift = "DAY" | "NIGHT"
export type CoverageStatus = "ok" | "amber" | "red"

export interface CoverageRole {
  id: string
  name: string
  sortOrder: number
  minDay: number
  targetDay: number
  minNight: number
  targetNight: number
  requiredQualification: string | null
  _count?: { defaultForGroups: number; dutyCodes: number }
}

export interface PositionGroup {
  id: string
  name: string
  sortOrder: number
  color: string | null
  defaultCoverageRoleId: string | null
  defaultCoverageRole?: { id: string; name: string } | null
  _count?: { members: number }
}

export interface RosterEntry {
  userId: string
  name: string
  via: string
  isBackfill: boolean
  unqualified: boolean
}

export interface RoleShiftCoverage {
  roleId: string
  roleName: string
  shift: CoverageShift
  have: number
  min: number
  target: number
  status: CoverageStatus
  roster: RosterEntry[]
}

export interface DayCoverage {
  date: string
  lines: RoleShiftCoverage[]
  status: CoverageStatus
}

export interface CoverageResult {
  configured: boolean
  roles: CoverageRole[]
  groups: PositionGroup[]
  days: DayCoverage[]
}

export const coverageKeys = {
  roles: ["coverage-roles"] as const,
  groups: ["position-groups"] as const,
  range: (start: string, end: string) => ["coverage", start, end] as const,
}

export function useCoverageRoles() {
  return useQuery({ queryKey: coverageKeys.roles, queryFn: () => apiGet<CoverageRole[]>("/api/coverage-roles") })
}

export function usePositionGroups() {
  return useQuery({ queryKey: coverageKeys.groups, queryFn: () => apiGet<PositionGroup[]>("/api/position-groups") })
}

export function useCoverage(startDate: string, endDate: string) {
  return useQuery({
    queryKey: coverageKeys.range(startDate, endDate),
    queryFn: () => apiGet<CoverageResult>(`/api/coverage${qs({ startDate, endDate })}`),
  })
}

function useInvalidateCoverage() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: coverageKeys.roles })
    qc.invalidateQueries({ queryKey: coverageKeys.groups })
    qc.invalidateQueries({ queryKey: ["coverage"] })
    qc.invalidateQueries({ queryKey: ["custom-shift-types"] })
    qc.invalidateQueries({ queryKey: ["workers"] })
  }
}

export type CoverageRoleInput = Omit<CoverageRole, "id" | "_count">
export type PositionGroupInput = Omit<PositionGroup, "id" | "_count" | "defaultCoverageRole">

export function useSaveCoverageRole() {
  const invalidate = useInvalidateCoverage()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CoverageRoleInput> & { id?: string }) =>
      id ? apiSend<CoverageRole>("PATCH", `/api/coverage-roles/${id}`, input) : apiSend<CoverageRole>("POST", "/api/coverage-roles", input),
    onSuccess: invalidate,
  })
}

export function useDeleteCoverageRole() {
  const invalidate = useInvalidateCoverage()
  return useMutation({ mutationFn: (id: string) => apiSend<null>("DELETE", `/api/coverage-roles/${id}`), onSuccess: invalidate })
}

export function useSavePositionGroup() {
  const invalidate = useInvalidateCoverage()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<PositionGroupInput> & { id?: string }) =>
      id ? apiSend<PositionGroup>("PATCH", `/api/position-groups/${id}`, input) : apiSend<PositionGroup>("POST", "/api/position-groups", input),
    onSuccess: invalidate,
  })
}

export function useDeletePositionGroup() {
  const invalidate = useInvalidateCoverage()
  return useMutation({ mutationFn: (id: string) => apiSend<null>("DELETE", `/api/position-groups/${id}`), onSuccess: invalidate })
}

export function useApplyCoverageTemplate() {
  const invalidate = useInvalidateCoverage()
  return useMutation({
    mutationFn: () => apiSend<{ roles: number; groups: number; codes: number }>("POST", "/api/coverage/template"),
    onSuccess: invalidate,
  })
}

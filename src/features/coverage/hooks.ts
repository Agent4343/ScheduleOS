import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend, qs } from "@/lib/api-client"

export type CoverageShift = "DAY" | "NIGHT"
export type CoverageStatus = "ok" | "amber" | "red"

export interface Qualification {
  id: string
  code: string
  name: string
  color: string | null
  sortOrder: number
  _count?: { requirements: number }
}

/** A role's sign-off requirement, as returned with the role */
export interface CoverageRequirement {
  id: string
  qualificationId: string
  countDay: number
  countNight: number
  qualification: { id: string; code: string; name: string }
}

export interface CoverageRole {
  id: string
  name: string
  sortOrder: number
  minDay: number
  targetDay: number
  minNight: number
  targetNight: number
  requiredQualification: string | null
  requirements?: CoverageRequirement[]
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

export interface SignOffCoverage {
  code: string
  name: string
  need: number
  filled: number
  by: { userId: string; name: string }[]
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
  signOffs: SignOffCoverage[]
  signOffShortfall: boolean
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
  qualifications: Qualification[]
  days: DayCoverage[]
}

export const coverageKeys = {
  roles: ["coverage-roles"] as const,
  qualifications: ["qualifications"] as const,
  groups: ["position-groups"] as const,
  range: (start: string, end: string) => ["coverage", start, end] as const,
}

export function useCoverageRoles() {
  return useQuery({ queryKey: coverageKeys.roles, queryFn: () => apiGet<CoverageRole[]>("/api/coverage-roles") })
}

export function useQualifications() {
  return useQuery({ queryKey: coverageKeys.qualifications, queryFn: () => apiGet<Qualification[]>("/api/qualifications") })
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
    qc.invalidateQueries({ queryKey: coverageKeys.qualifications })
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

export type QualificationInput = Omit<Qualification, "id" | "_count">

export function useSaveQualification() {
  const invalidate = useInvalidateCoverage()
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<QualificationInput> & { id?: string }) =>
      id ? apiSend<Qualification>("PATCH", `/api/qualifications/${id}`, input) : apiSend<Qualification>("POST", "/api/qualifications", input),
    onSuccess: invalidate,
  })
}

export function useDeleteQualification() {
  const invalidate = useInvalidateCoverage()
  return useMutation({ mutationFn: (id: string) => apiSend<null>("DELETE", `/api/qualifications/${id}`), onSuccess: invalidate })
}

/** Replace a role's sign-off requirements wholesale. */
export function useSaveRequirements() {
  const invalidate = useInvalidateCoverage()
  return useMutation({
    mutationFn: ({ roleId, requirements }: { roleId: string; requirements: { qualificationId: string; countDay: number; countNight: number }[] }) =>
      apiSend<CoverageRequirement[]>("PUT", `/api/coverage-roles/${roleId}/requirements`, { requirements }),
    onSuccess: invalidate,
  })
}

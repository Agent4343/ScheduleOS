import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend } from "@/lib/api-client"
import type { Organization, OrganizationSettings } from "@/features/types"

export const organizationKeys = { current: ["organization"] as const }

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.current,
    queryFn: () => apiGet<Organization>("/api/organization"),
  })
}

export interface UpdateOrganizationInput {
  name?: string
  /** Partial: only the keys you send change; billing keys are server-managed */
  settings?: OrganizationSettings
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) => apiSend<Organization>("PATCH", "/api/organization", input),
    onSuccess: ({ data }) => qc.setQueryData(organizationKeys.current, data),
  })
}

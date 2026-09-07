import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiSend } from "@/lib/api-client"

export interface Invitation {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "SUPERVISOR" | "WORKER"
  expiresAt: string
  createdAt: string
  expired: boolean
}

export interface CreateInvitationInput {
  email: string
  name?: string
  role?: Invitation["role"]
}

export const invitationKeys = { all: ["invitations"] as const }

export function useInvitations(enabled = true) {
  return useQuery({
    queryKey: invitationKeys.all,
    queryFn: () => apiGet<Invitation[]>("/api/invitations"),
    enabled,
  })
}

/** Returns the invite link — shown once, because only its hash is stored. */
export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      apiSend<{ invitation: Invitation; url: string }>("POST", "/api/invitations", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.all }),
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/api/invitations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.all }),
  })
}

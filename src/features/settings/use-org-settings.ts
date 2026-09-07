"use client"

import { useToast } from "@/components/ui/toast"
import { errorMessage } from "@/lib/api-client"
import type { OrganizationSettings } from "@/features/types"
import { useOrganization, useUpdateOrganization } from "@/features/organization/hooks"

/**
 * Read the organization and save individual settings as they change.
 *
 * One save model for the whole Settings page: every control persists
 * immediately (the server merges the keys you send over the stored JSON),
 * so there is no "Save All" button to forget and no half-saved state.
 */
export function useOrgSettings() {
  const toast = useToast()
  const orgQuery = useOrganization()
  const update = useUpdateOrganization()

  const saveSettings = async (patch: OrganizationSettings, successMessage?: string) => {
    try {
      await update.mutateAsync({ settings: patch })
      if (successMessage) toast.success(successMessage)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save setting"))
    }
  }

  const saveName = async (name: string) => {
    try {
      await update.mutateAsync({ name })
      toast.success("Organization name saved")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save organization name"))
    }
  }

  return {
    organization: orgQuery.data ?? null,
    settings: orgQuery.data?.settings ?? {},
    isLoading: orgQuery.isPending,
    error: orgQuery.error,
    refetch: orgQuery.refetch,
    saving: update.isPending,
    saveSettings,
    saveName,
  }
}

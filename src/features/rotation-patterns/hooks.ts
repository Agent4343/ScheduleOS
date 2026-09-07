import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import type { RotationPattern } from "@/features/types"

export const rotationPatternKeys = { all: ["rotation-patterns"] as const }

export function useRotationPatterns() {
  return useQuery({
    queryKey: rotationPatternKeys.all,
    queryFn: () => apiGet<RotationPattern[]>("/api/rotation-patterns"),
  })
}

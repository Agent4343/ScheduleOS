import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { crewsApi, type CreateCrewInput, type UpdateCrewInput } from "./api"
import { scheduleKeys } from "@/features/schedules/hooks"

export const crewKeys = {
  all: ["crews"] as const,
  detail: (id: string) => ["crews", id] as const,
}

export function useCrews() {
  return useQuery({ queryKey: crewKeys.all, queryFn: crewsApi.list })
}

export function useCreateCrew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCrewInput) => crewsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: crewKeys.all }),
  })
}

export function useUpdateCrew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateCrewInput & { id: string }) => crewsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewKeys.all })
      // Workers embed crew name/colour
      qc.invalidateQueries({ queryKey: ["workers"] })
    },
  })
}

export function useDeleteCrew() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => crewsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: crewKeys.all })
      qc.invalidateQueries({ queryKey: ["workers"] })
      qc.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { workersApi, type CreateWorkerInput, type UpdateWorkerInput, type WorkerFilters } from "./api"
import { scheduleKeys } from "@/features/schedules/hooks"

export const workerKeys = {
  all: ["workers"] as const,
  list: (filters: WorkerFilters = {}) =>
    ["workers", filters.crewId ?? "all", filters.status ?? "all", filters.role ?? "all"] as const,
  detail: (id: string) => ["workers", "detail", id] as const,
}

export function useWorkers(filters: WorkerFilters = {}) {
  return useQuery({ queryKey: workerKeys.list(filters), queryFn: () => workersApi.list(filters) })
}

export function useCreateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWorkerInput) => workersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workerKeys.all })
      qc.invalidateQueries({ queryKey: ["crews"] }) // member counts
    },
  })
}

export function useUpdateWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateWorkerInput & { id: string }) => workersApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workerKeys.all })
      qc.invalidateQueries({ queryKey: ["crews"] })
      qc.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

export function useDeleteWorker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workerKeys.all })
      qc.invalidateQueries({ queryKey: ["crews"] })
      qc.invalidateQueries({ queryKey: scheduleKeys.all })
    },
  })
}

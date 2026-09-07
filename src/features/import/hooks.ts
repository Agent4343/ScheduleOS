import { useMutation } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"

export interface ImportPlan {
  sheetName: string
  availableSheets: string[]
  dateRange: { start: string; end: string; days: number } | null
  groups: { name: string; existing: boolean; members: number }[]
  people: { name: string; group: string | null; qualifications: string[]; matchedId: string | null; shifts: number }[]
  codes: { code: string; count: number; known: boolean }[]
  shiftCount: number
  warnings: string[]
}

export interface ImportResult {
  groupsCreated: number
  peopleCreated: number
  peopleUpdated: number
  codesCreated: number
  shiftsWritten: number
  shiftsReplaced: number
  skipped: string[]
}

export interface ImportOptions {
  sheet?: string
  commit?: boolean
  createMissingPeople?: boolean
  replaceRange?: boolean
}

/**
 * Uploads the workbook. Without `commit` the server only describes what it
 * would do; the same call with `commit` performs it.
 *
 * Uses fetch directly rather than the JSON api-client, because this posts
 * multipart form data.
 */
async function postWorkbook(file: File, options: ImportOptions) {
  const body = new FormData()
  body.append("file", file)
  if (options.sheet) body.append("sheet", options.sheet)
  if (options.commit) body.append("commit", "true")
  body.append("createMissingPeople", String(options.createMissingPeople ?? false))
  body.append("replaceRange", String(options.replaceRange ?? true))

  const res = await fetch("/api/import/schedule", { method: "POST", body })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || "The import failed")
  return json.data as { plan: ImportPlan; imported: ImportResult | null }
}

export function useImportSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, ...options }: ImportOptions & { file: File }) => postWorkbook(file, options),
    onSuccess: (data) => {
      // Only a committed import changes anything worth refetching
      if (!data.imported) return
      qc.invalidateQueries({ queryKey: ["workers"] })
      qc.invalidateQueries({ queryKey: ["schedules"] })
      qc.invalidateQueries({ queryKey: ["coverage"] })
      qc.invalidateQueries({ queryKey: ["position-groups"] })
      qc.invalidateQueries({ queryKey: ["qualifications"] })
      qc.invalidateQueries({ queryKey: ["custom-shift-types"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

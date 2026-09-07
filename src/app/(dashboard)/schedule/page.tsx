"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { ChevronLeft, ChevronRight, Calendar, Users, Loader2, Info, CalendarPlus } from "lucide-react"
import { errorMessage } from "@/lib/api-client"
import { useRole } from "@/lib/auth/use-role"
import type { Worker } from "@/features/types"
import { useCrews } from "@/features/crews/hooks"
import { useWorkers, useUpdateWorker } from "@/features/workers/hooks"
import { useSchedules } from "@/features/schedules/hooks"
import { useCustomShiftTypes } from "@/features/custom-shift-types/hooks"
import { useOrganization } from "@/features/organization/hooks"
import { mergeShiftStyles } from "@/features/schedules/shift-styles"
import { ScheduleGrid, type GridWorker } from "@/features/schedules/components/schedule-grid"
import { ShiftLegend } from "@/features/schedules/components/shift-legend"
import { OverrideShiftDialog } from "@/features/schedules/components/override-shift-dialog"
import { GenerateScheduleDialog } from "@/features/schedules/components/generate-schedule-dialog"
import { WorkerForm, type WorkerFormValues } from "@/features/workers/components/worker-form"

type Dialog =
  | { kind: "worker"; worker: Worker }
  | { kind: "generate"; worker: Worker }
  | { kind: "override"; worker: GridWorker; date: string }
  | null

function SchedulePageContent() {
  const { isStaff, isAdmin, userId } = useRole()
  const toast = useToast()
  const searchParams = useSearchParams()

  const [year, setYear] = useState(() => {
    const fromUrl = parseInt(searchParams.get("year") ?? "")
    return Number.isFinite(fromUrl) && fromUrl > 2000 && fromUrl < 2100 ? fromUrl : new Date().getFullYear()
  })
  const [crewId, setCrewId] = useState("")
  const [showLegend, setShowLegend] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)

  // Data. Each query is keyed by its inputs, so changing year/crew never
  // lets a slow earlier response overwrite a newer one.
  const crewsQuery = useCrews()
  const workersQuery = useWorkers({ status: "ACTIVE", crewId: crewId || undefined })
  const schedulesQuery = useSchedules({ startDate: `${year}-01-01`, endDate: `${year}-12-31`, crewId: crewId || undefined })
  const customTypesQuery = useCustomShiftTypes()
  const orgQuery = useOrganization()
  const updateWorker = useUpdateWorker()

  const crews = crewsQuery.data ?? []
  const styles = useMemo(
    () => mergeShiftStyles(customTypesQuery.data ?? [], orgQuery.data?.settings.shiftColors ?? {}),
    [customTypesQuery.data, orgQuery.data?.settings.shiftColors]
  )
  const workers = useMemo(
    () =>
      [...(workersQuery.data ?? [])].sort(
        (a, b) => (a.crew?.name || "ZZZ").localeCompare(b.crew?.name || "ZZZ") || (a.name || "").localeCompare(b.name || "")
      ),
    [workersQuery.data]
  )
  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])

  const saveWorker = async (worker: Worker, values: WorkerFormValues) => {
    try {
      await updateWorker.mutateAsync({
        id: worker.id,
        name: values.name,
        email: values.email,
        position: values.position || undefined,
        phone: values.phone || undefined,
        crewId: values.crewId || null,
        hireDate: values.hireDate || undefined,
        ...(isAdmin && worker.id !== userId && { role: values.role, status: values.status }),
      })
      toast.success(`${values.name} updated`)
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update worker"))
    }
  }

  const loading = workersQuery.isPending || schedulesQuery.isPending
  const loadError = workersQuery.error ?? schedulesQuery.error

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule Calendar</h1>
          <p className="text-muted-foreground">
            {year} · full year · {workers.length} workers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear(new Date().getFullYear())}>
            This Year
          </Button>
          <Button variant="outline" size="icon" aria-label="Previous year" onClick={() => setYear(year - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold px-4 text-lg" aria-live="polite">{year}</span>
          <Button variant="outline" size="icon" aria-label="Next year" onClick={() => setYear(year + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="crew-filter" className="text-sm text-muted-foreground">
          Filter by Crew:
        </label>
        <Select
          id="crew-filter"
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
          options={[{ value: "", label: "All Crews" }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
          className="w-40"
        />
        <Button variant="outline" size="sm" onClick={() => setShowLegend((v) => !v)} aria-expanded={showLegend}>
          <Info className="h-4 w-4 mr-1" />
          {showLegend ? "Hide Legend" : "Show Legend"}
        </Button>
      </div>
      {showLegend && <ShiftLegend styles={styles} />}

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(loadError, "Could not load the schedule")}{" "}
            <button className="underline" onClick={() => { workersQuery.refetch(); schedulesQuery.refetch() }}>
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {year} Schedule
            <Badge variant="secondary" className="ml-2">
              <Users className="h-3 w-3 mr-1" />
              {workers.length} workers
            </Badge>
          </CardTitle>
          {isStaff && (
            <p className="text-xs text-muted-foreground">
              Click a worker to edit them or generate their rotation; click a day to set a shift.
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active workers{crewId ? " in this crew" : ""}</p>
            </div>
          ) : (
            <ScheduleGrid
              year={year}
              workers={workers}
              schedules={schedulesQuery.data ?? []}
              styles={styles}
              editable={isStaff}
              onWorkerClick={(w) => {
                const worker = workerById.get(w.id)
                if (worker) setDialog({ kind: "worker", worker })
              }}
              onDayClick={(worker, date) => setDialog({ kind: "override", worker, date })}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit worker (profile) + a way into the generator */}
      <Modal
        isOpen={dialog?.kind === "worker"}
        onClose={() => setDialog(null)}
        title="Edit Worker"
        description={dialog?.kind === "worker" ? dialog.worker.email : undefined}
      >
        {dialog?.kind === "worker" && (
          <div className="space-y-4">
            <WorkerForm
              key={dialog.worker.id}
              worker={dialog.worker}
              crews={crews}
              submitting={updateWorker.isPending}
              onSubmit={(values) => saveWorker(dialog.worker, values)}
              onCancel={() => setDialog(null)}
            />
            <div className="border-t pt-4">
              <Button variant="outline" className="w-full" onClick={() => setDialog({ kind: "generate", worker: dialog.worker })}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                Generate this worker&apos;s rotation…
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <GenerateScheduleDialog
        key={dialog?.kind === "generate" ? dialog.worker.id : "none"}
        open={dialog?.kind === "generate"}
        onClose={() => setDialog(null)}
        target={
          dialog?.kind === "generate"
            ? {
                kind: "worker",
                worker: {
                  id: dialog.worker.id,
                  name: dialog.worker.name,
                  crew: dialog.worker.crew ? crews.find((c) => c.id === dialog.worker.crew!.id) ?? null : null,
                },
              }
            : null
        }
        defaultMonths={12}
      />

      <OverrideShiftDialog
        key={dialog?.kind === "override" ? `${dialog.worker.id}-${dialog.date}` : "none"}
        open={dialog?.kind === "override"}
        onClose={() => setDialog(null)}
        worker={dialog?.kind === "override" ? dialog.worker : null}
        date={dialog?.kind === "override" ? dialog.date : null}
        styles={styles}
      />
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SchedulePageContent />
    </Suspense>
  )
}

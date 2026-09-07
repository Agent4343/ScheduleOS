"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Users2, Plus, Users, Calendar, Settings, MoreVertical, RefreshCw, Pencil, Trash2 } from "lucide-react"
import { errorMessage } from "@/lib/api-client"
import { formatDateOnly } from "@/lib/dates"
import type { Crew } from "@/features/types"
import { useCrews, useCreateCrew, useUpdateCrew, useDeleteCrew } from "@/features/crews/hooks"
import { useRotationPatterns } from "@/features/rotation-patterns/hooks"
import { GenerateScheduleDialog } from "@/features/schedules/components/generate-schedule-dialog"
import { CrewForm, type CrewFormValues } from "@/features/crews/components/crew-form"

export default function CrewsPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const crewsQuery = useCrews()
  const patternsQuery = useRotationPatterns()
  const createCrew = useCreateCrew()
  const updateCrew = useUpdateCrew()
  const deleteCrew = useDeleteCrew()

  const crews = crewsQuery.data ?? []
  const patterns = patternsQuery.data ?? []

  // Which dialog is open. One piece of state instead of three booleans.
  const [dialog, setDialog] = useState<{ kind: "create" } | { kind: "edit"; crew: Crew } | { kind: "generate"; crew: Crew } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the kebab menu when clicking outside it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openEdit = (crew: Crew) => {
    setOpenMenuId(null)
    setDialog({ kind: "edit", crew })
  }

  const handleCreate = async (values: CrewFormValues) => {
    try {
      await createCrew.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        color: values.color,
        rotationPatternId: values.rotationPatternId || undefined,
      })
      toast.success(`Crew ${values.name} created`)
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create crew"))
    }
  }

  const handleUpdate = async (crew: Crew, values: CrewFormValues) => {
    try {
      await updateCrew.mutateAsync({
        id: crew.id,
        name: values.name,
        description: values.description || null,
        color: values.color,
        rotationPatternId: values.rotationPatternId || null,
        currentPhase: values.currentPhase,
      })
      toast.success("Crew updated")
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update crew"))
    }
  }

  const handleDelete = async (crew: Crew) => {
    setOpenMenuId(null)
    const ok = await confirm({
      title: `Delete ${crew.name}?`,
      description: `${crew._count.workers} worker(s) will be left without a crew. Their schedules are kept. This cannot be undone.`,
      confirmLabel: "Delete crew",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCrew.mutateAsync(crew.id)
      toast.success(`Crew ${crew.name} deleted`)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete crew"))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crews</h1>
          <p className="text-muted-foreground">Manage your crew rotations ({crews.length} crews)</p>
        </div>
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Plus className="h-4 w-4 mr-2" />
          Add Crew
        </Button>
      </div>

      {crewsQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(crewsQuery.error, "Could not load crews")}{" "}
            <button className="underline" onClick={() => crewsQuery.refetch()}>
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Crews grid */}
      {crewsQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : crews.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No crews yet</h3>
            <p className="text-muted-foreground mb-4">Create your first crew to start organizing your workforce</p>
            <Button onClick={() => setDialog({ kind: "create" })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Crew
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {crews.map((crew) => (
            <Card key={crew.id} className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: crew.color }} />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: crew.color }}
                      aria-hidden
                    >
                      {crew.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{crew.name}</CardTitle>
                      <CardDescription>{crew.description || "No description"}</CardDescription>
                    </div>
                  </div>
                  <div className="relative" ref={openMenuId === crew.id ? menuRef : null}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${crew.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === crew.id}
                      onClick={() => setOpenMenuId(openMenuId === crew.id ? null : crew.id)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {openMenuId === crew.id && (
                      <div role="menu" className="absolute right-0 top-full mt-1 w-40 bg-background border rounded-md shadow-lg z-10">
                        <button
                          role="menuitem"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                          onClick={() => openEdit(crew)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          role="menuitem"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-600"
                          onClick={() => handleDelete(crew)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Workers</span>
                  </div>
                  <Badge variant="secondary">{crew._count.workers}</Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Pattern</span>
                  </div>
                  {crew.rotationPattern ? (
                    <Badge>
                      {crew.rotationPattern.daysOn}/{crew.rotationPattern.daysOff}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Not set</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Today</span>
                  </div>
                  <span className="font-mono" title={crew.rotationAnchorDate ? `Anchored ${formatDateOnly(crew.rotationAnchorDate)}` : "Not yet generated"}>
                    Day {crew.currentPhase + 1}
                    {!crew.rotationAnchorDate && <span className="text-muted-foreground"> (planned)</span>}
                  </span>
                </div>

                <div className="pt-2 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDialog({ kind: "generate", crew })}
                    disabled={!crew.rotationPattern}
                    title={crew.rotationPattern ? undefined : "Assign a rotation pattern first"}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {crew.rotationAnchorDate ? "Extend" : "Generate"}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(crew)}>
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={dialog?.kind === "create"}
        onClose={() => setDialog(null)}
        title="Add Crew"
        description="Create a new crew for shift rotations"
      >
        <CrewForm
          patterns={patterns}
          submitting={createCrew.isPending}
          onSubmit={handleCreate}
          onCancel={() => setDialog(null)}
        />
      </Modal>

      <Modal
        isOpen={dialog?.kind === "edit"}
        onClose={() => setDialog(null)}
        title="Edit Crew"
        description="Update crew settings and configuration"
      >
        {dialog?.kind === "edit" && (
          <CrewForm
            key={dialog.crew.id}
            crew={dialog.crew}
            patterns={patterns}
            submitting={updateCrew.isPending}
            onSubmit={(values) => handleUpdate(dialog.crew, values)}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>

      <GenerateScheduleDialog
        key={dialog?.kind === "generate" ? dialog.crew.id : "none"}
        open={dialog?.kind === "generate"}
        onClose={() => setDialog(null)}
        target={dialog?.kind === "generate" ? { kind: "crew", crew: dialog.crew } : null}
      />
    </div>
  )
}

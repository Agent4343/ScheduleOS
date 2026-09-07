"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Avatar } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Users, Plus, Search, Mail, Filter, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { errorMessage } from "@/lib/api-client"
import { useRole } from "@/lib/auth/use-role"
import type { UserStatus, Worker } from "@/features/types"
import { useWorkers, useCreateWorker, useUpdateWorker, useDeleteWorker } from "@/features/workers/hooks"
import { useCrews } from "@/features/crews/hooks"
import { InvitePanel } from "@/features/invitations/components/invite-panel"
import { WorkerForm, workerPayload, ROLE_LABELS, STATUS_LABELS, type WorkerFormValues } from "@/features/workers/components/worker-form"

const STATUS_VARIANT: Record<UserStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  ON_LEAVE: "outline",
  TERMINATED: "destructive",
}

export default function WorkersPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { isAdmin, userId } = useRole()

  const workersQuery = useWorkers()
  const crewsQuery = useCrews()
  const createWorker = useCreateWorker()
  const updateWorker = useUpdateWorker()
  const deleteWorker = useDeleteWorker()

  const workers = workersQuery.data ?? []
  const crews = crewsQuery.data ?? []

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | UserStatus>("")
  const [crewFilter, setCrewFilter] = useState("")
  const [dialog, setDialog] = useState<{ kind: "create" } | { kind: "invite" } | { kind: "edit"; worker: Worker } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return workers.filter(
      (w) =>
        (!q || w.name?.toLowerCase().includes(q) || w.email.toLowerCase().includes(q)) &&
        (!statusFilter || w.status === statusFilter) &&
        (!crewFilter || w.crew?.id === crewFilter)
    )
  }, [workers, searchQuery, statusFilter, crewFilter])

  const handleCreate = async (values: WorkerFormValues) => {
    try {
      await createWorker.mutateAsync({
        ...workerPayload(values),
        role: values.role,
        crewId: values.crewId || undefined,
        password: values.password,
      })
      toast.success(`${values.name} added. They can sign in with their email and the temporary password.`)
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add worker"))
    }
  }

  const handleUpdate = async (worker: Worker, values: WorkerFormValues) => {
    try {
      await updateWorker.mutateAsync({
        id: worker.id,
        ...workerPayload(values),
        crewId: values.crewId || null,
        // Only send role/status when the caller is allowed to change them
        ...(isAdmin && worker.id !== userId && { role: values.role, status: values.status }),
      })
      toast.success(`${values.name} updated`)
      setDialog(null)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update worker"))
    }
  }

  const handleDelete = async (worker: Worker) => {
    setOpenMenuId(null)
    const ok = await confirm({
      title: `Delete ${worker.name || worker.email}?`,
      description: "Their schedules, time off and attendance records are deleted too. This cannot be undone. To keep the history, set their status to Terminated instead.",
      confirmLabel: "Delete worker",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteWorker.mutateAsync(worker.id)
      toast.success("Worker deleted")
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete worker"))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-muted-foreground">Manage your workforce ({workers.length} total)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDialog({ kind: "invite" })}>
            <Mail className="h-4 w-4 mr-2" />
            Invite
          </Button>
          <Button variant="outline" onClick={() => setDialog({ kind: "create" })}>
            <Plus className="h-4 w-4 mr-2" />
            Add directly
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search workers..."
            aria-label="Search workers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | UserStatus)}
            options={[
              { value: "", label: "All Status" },
              ...(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ]}
            className="w-36"
          />
          <Select
            aria-label="Filter by crew"
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            options={[{ value: "", label: "All Crews" }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
            className="w-36"
          />
        </div>
      </div>

      {workersQuery.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(workersQuery.error, "Could not load workers")}{" "}
            <button className="underline" onClick={() => workersQuery.refetch()}>
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workersQuery.isPending ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{workers.length === 0 ? "No workers yet" : "No workers match these filters"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar alt={worker.name || worker.email} size="sm" />
                        <div>
                          <p className="font-medium">{worker.name || "Unnamed"}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" aria-hidden />
                            {worker.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {worker.crew ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: worker.crew.color }} aria-hidden />
                          {worker.crew.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{worker.position || "-"}</TableCell>
                    <TableCell>{ROLE_LABELS[worker.role]}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[worker.status]}>{STATUS_LABELS[worker.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="relative" ref={openMenuId === worker.id ? menuRef : null}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${worker.name || worker.email}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === worker.id}
                          onClick={() => setOpenMenuId(openMenuId === worker.id ? null : worker.id)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {openMenuId === worker.id && (
                          <div role="menu" className="absolute right-0 top-full mt-1 w-36 bg-background border rounded-md shadow-lg z-10">
                            <button
                              role="menuitem"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                              onClick={() => {
                                setOpenMenuId(null)
                                setDialog({ kind: "edit", worker })
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            {isAdmin && worker.id !== userId && (
                              <button
                                role="menuitem"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                                onClick={() => handleDelete(worker)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={dialog?.kind === "invite"}
        onClose={() => setDialog(null)}
        title="Invite someone"
        description="They get a link, choose their own password, and appear here once they have joined"
      >
        <InvitePanel onDone={() => setDialog(null)} />
      </Modal>

      <Modal
        isOpen={dialog?.kind === "create"}
        onClose={() => setDialog(null)}
        title="Add Worker"
        description="Creates the account yourself, with a password you set and pass on. Inviting is usually easier."
      >
        <WorkerForm crews={crews} submitting={createWorker.isPending} onSubmit={handleCreate} onCancel={() => setDialog(null)} />
      </Modal>

      <Modal
        isOpen={dialog?.kind === "edit"}
        onClose={() => setDialog(null)}
        title="Edit Worker"
        description="Update worker information"
      >
        {dialog?.kind === "edit" && (
          <WorkerForm
            key={dialog.worker.id}
            worker={dialog.worker}
            crews={crews}
            submitting={updateWorker.isPending}
            onSubmit={(values) => handleUpdate(dialog.worker, values)}
            onCancel={() => setDialog(null)}
          />
        )}
      </Modal>
    </div>
  )
}

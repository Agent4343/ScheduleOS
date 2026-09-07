"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { useRole } from "@/lib/auth/use-role"
import { toDateKey } from "@/lib/dates"
import type { CrewRef, UserRole, UserStatus, Worker } from "@/features/types"

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  SUPERVISOR: "Supervisor",
  WORKER: "Worker",
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ON_LEAVE: "On Leave",
  TERMINATED: "Terminated",
}

/** Matches the server's createUserSchema minimum. */
const MIN_PASSWORD_LENGTH = 8

export interface WorkerFormValues {
  name: string
  email: string
  role: UserRole
  status: UserStatus
  position: string
  phone: string
  crewId: string
  /** YYYY-MM-DD or "" */
  hireDate: string
  password: string
}

interface WorkerFormProps {
  /** Existing worker to edit; omit to create. */
  worker?: Worker
  crews: CrewRef[]
  /** Pre-select a crew on create (e.g. from the crew page). */
  defaultCrewId?: string
  submitting: boolean
  onSubmit: (values: WorkerFormValues) => void
  onCancel: () => void
  /** Hide the role/status controls (e.g. quick edit from the schedule). */
  compact?: boolean
}

/**
 * One form for adding and editing a worker. Used by the Workers page, the
 * schedule's edit-worker dialog and onboarding, so the rules live here once:
 *
 * - A new account needs a password (there is no invite flow yet), and it is
 *   shown once on success by the caller.
 * - Only admins can pick a role or change status; supervisors create workers.
 * - You cannot change your own role or status.
 */
export function WorkerForm({ worker, crews, defaultCrewId, submitting, onSubmit, onCancel, compact }: WorkerFormProps) {
  const mode = worker ? "edit" : "create"
  const { isAdmin, userId } = useRole()
  const isSelf = !!worker && worker.id === userId
  const canChangeRole = isAdmin && !isSelf
  const canChangeStatus = isAdmin && !isSelf && mode === "edit"

  const [values, setValues] = useState<WorkerFormValues>({
    name: worker?.name ?? "",
    email: worker?.email ?? "",
    role: worker?.role ?? "WORKER",
    status: worker?.status ?? "ACTIVE",
    position: worker?.position ?? "",
    phone: worker?.phone ?? "",
    crewId: worker?.crew?.id ?? defaultCrewId ?? "",
    hireDate: worker?.hireDate ? toDateKey(worker.hireDate) : "",
    password: "",
  })
  const set = <K extends keyof WorkerFormValues>(key: K, value: WorkerFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const [showPassword, setShowPassword] = useState(false)
  const id = (field: string) => `${mode}-worker-${field}`

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={id("name")}>Full Name *</Label>
          <Input id={id("name")} value={values.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("email")}>Email *</Label>
          <Input id={id("email")} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" />
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={id("role")}>Role</Label>
            <Select
              id={id("role")}
              value={values.role}
              onChange={(e) => set("role", e.target.value as UserRole)}
              disabled={!canChangeRole}
              options={(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
            {!canChangeRole && (
              <p className="text-xs text-muted-foreground">
                {isSelf ? "You cannot change your own role." : "Only an admin can assign roles."}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("crew")}>Crew</Label>
            <Select
              id={id("crew")}
              value={values.crewId}
              onChange={(e) => set("crewId", e.target.value)}
              options={[{ value: "", label: "No Crew" }, ...crews.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={id("position")}>Position</Label>
          <Input id={id("position")} value={values.position} onChange={(e) => set("position", e.target.value)} placeholder="e.g., Operator" maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("phone")}>Phone</Label>
          <Input id={id("phone")} type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={id("hireDate")}>Hire Date</Label>
          <Input id={id("hireDate")} type="date" value={values.hireDate} onChange={(e) => set("hireDate", e.target.value)} />
        </div>

        {mode === "create" ? (
          <div className="space-y-2">
            <Label htmlFor={id("password")}>Temporary Password *</Label>
            <div className="flex gap-2">
              <Input
                id={id("password")}
                type={showPassword ? "text" : "password"}
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              <Button type="button" variant="outline" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters. Share it with the worker; they can change it in Settings.
            </p>
          </div>
        ) : (
          canChangeStatus && (
            <div className="space-y-2">
              <Label htmlFor={id("status")}>Status</Label>
              <Select
                id={id("status")}
                value={values.status}
                onChange={(e) => set("status", e.target.value as UserStatus)}
                options={(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            </div>
          )
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (mode === "create" ? "Adding…" : "Saving…") : mode === "create" ? "Add Worker" : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}

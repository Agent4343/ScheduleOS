"use client"

import { useState } from "react"
import { Building2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { errorMessage } from "@/lib/api-client"
import type { Organization } from "@/features/types"
import { useCrews } from "@/features/crews/hooks"
import { useCreateWorker } from "@/features/workers/hooks"
import { WorkerForm, type WorkerFormValues } from "@/features/workers/components/worker-form"
import { SettingsCard } from "./settings-card"

interface Props {
  organization: Organization
  isAdmin: boolean
  saving: boolean
  onSaveName: (name: string) => Promise<void>
}

export function OrganizationCard({ organization, isAdmin, saving, onSaveName }: Props) {
  const [name, setName] = useState(organization.name)
  const [addOpen, setAddOpen] = useState(false)
  const toast = useToast()
  const crews = useCrews()
  const createWorker = useCreateWorker()
  const dirty = name.trim() !== organization.name

  const handleAdd = async (values: WorkerFormValues) => {
    try {
      await createWorker.mutateAsync({
        name: values.name,
        email: values.email,
        role: values.role,
        position: values.position || undefined,
        phone: values.phone || undefined,
        crewId: values.crewId || undefined,
        hireDate: values.hireDate || undefined,
        password: values.password,
      })
      toast.success(`${values.name} added. They can sign in with their email and the temporary password.`)
      setAddOpen(false)
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add user"))
    }
  }

  return (
    <SettingsCard icon={Building2} title="Organization" description="Basic organization information">
      <div className="space-y-2">
        <Label htmlFor="orgName">Organization Name</Label>
        <div className="flex gap-2">
          <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} maxLength={100} />
          {isAdmin && (
            <Button onClick={() => onSaveName(name.trim())} disabled={!dirty || saving || name.trim().length < 2}>
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
        {[
          ["Workers", organization._count?.users ?? 0],
          ["Crews", organization._count?.crews ?? 0],
          ["Patterns", organization._count?.rotationPatterns ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="text-center">
            <p className="text-2xl font-bold tabular-nums">{n}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <Button variant="outline" className="w-full" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add User" description="Create an account for someone in your organization">
        <WorkerForm crews={crews.data ?? []} submitting={createWorker.isPending} onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
    </SettingsCard>
  )
}

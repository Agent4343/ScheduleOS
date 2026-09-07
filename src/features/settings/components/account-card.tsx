"use client"

import { useState, type FormEvent } from "react"
import { signOut, useSession } from "next-auth/react"
import { AlertTriangle, Key, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { apiSend, errorMessage } from "@/lib/api-client"
import { SettingsCard } from "./settings-card"

const MIN_PASSWORD_LENGTH = 8

export function AccountCard({ organizationName }: { organizationName: string }) {
  const { data: session } = useSession()
  const toast = useToast()
  const confirm = useConfirm()
  const [passwordOpen, setPasswordOpen] = useState(false)

  const deleteAccount = async () => {
    const ok = await confirm({
      title: "Delete your account?",
      description: "This permanently deletes your account and cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
      typeToConfirm: "DELETE",
    })
    if (!ok) return
    try {
      await apiSend("DELETE", "/api/auth/delete-account")
      await signOut({ callbackUrl: "/" })
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete account"))
    }
  }

  return (
    <SettingsCard icon={Shield} title="Your Account" description="Your personal sign-in details" className="md:col-span-2">
      <dl className="grid md:grid-cols-4 gap-4">
        <div>
          <dt className="text-muted-foreground text-xs">Name</dt>
          <dd className="font-medium">{session?.user?.name || "Not set"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Email</dt>
          <dd className="font-medium">{session?.user?.email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Role</dt>
          <dd>
            <Badge>{session?.user?.role}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Organization</dt>
          <dd className="font-medium">{organizationName}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setPasswordOpen(true)}>
          <Key className="h-4 w-4 mr-2" /> Change Password
        </Button>
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={deleteAccount}>
          <AlertTriangle className="h-4 w-4 mr-2" /> Delete Account
        </Button>
      </div>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </SettingsCard>
  )
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [busy, setBusy] = useState(false)
  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword

  const close = () => {
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    try {
      await apiSend("POST", "/api/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      toast.success("Password changed")
      close()
    } catch (error) {
      toast.error(errorMessage(error, "Failed to change password"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={close} title="Change Password" description="Enter your current password and choose a new one">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input id="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input id="newPassword" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
          <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required aria-invalid={mismatch} />
          {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || mismatch}>
            {busy ? "Changing…" : "Change Password"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

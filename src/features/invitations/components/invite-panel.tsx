"use client"

import { useState, type FormEvent } from "react"
import { Check, Copy, Mail, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { errorMessage } from "@/lib/api-client"
import { formatDateOnly } from "@/lib/dates"
import { useRole } from "@/lib/auth/use-role"
import { useInvitations, useCreateInvitation, useRevokeInvitation, type Invitation } from "../hooks"

const ROLE_OPTIONS = [
  { value: "WORKER", label: "Worker" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ADMIN", label: "Administrator" },
]

/**
 * Invite someone by link rather than by inventing a password for them.
 *
 * The link appears once, here: only its hash is stored, so it cannot be shown
 * again. Re-inviting the same address issues a fresh link, which is also how
 * you replace one somebody lost.
 */
export function InvitePanel({ onDone }: { onDone?: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { isAdmin } = useRole()
  const invitations = useInvitations()
  const create = useCreateInvitation()
  const revoke = useRevokeInvitation()

  const [form, setForm] = useState({ email: "", name: "", role: "WORKER" as Invitation["role"] })
  const [link, setLink] = useState<{ url: string; email: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await create.mutateAsync({
        email: form.email,
        name: form.name.trim() || undefined,
        role: form.role,
      })
      setLink({ url: data.url, email: data.invitation.email })
      setCopied(false)
      setForm({ email: "", name: "", role: "WORKER" })
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the invitation"))
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      toast.success("Link copied")
    } catch {
      // Clipboard access can be refused; the link is on screen to copy by hand
      toast.error("Could not copy automatically — select the link and copy it.")
    }
  }

  const remove = async (invitation: Invitation) => {
    if (!(await confirm({
      title: `Withdraw the invitation to ${invitation.email}?`,
      description: "Their link stops working immediately.",
      confirmLabel: "Withdraw",
      destructive: true,
    }))) return
    try {
      await revoke.mutateAsync(invitation.id)
      toast.success("Invitation withdrawn")
    } catch (error) {
      toast.error(errorMessage(error, "Could not withdraw the invitation"))
    }
  }

  const pending = invitations.data ?? []

  return (
    <div className="space-y-4">
      {link ? (
        <div className="space-y-3">
          <Alert>
            <AlertDescription>
              <p className="font-medium">Invitation ready for {link.email}</p>
              <p className="mt-1 text-sm">
                Send them this link. It works once, lasts a week, and they choose their own password — you never need to
                handle it. <strong>This is the only time the link is shown.</strong>
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setLink(null)}>Invite someone else</Button>
            {onDone && <Button type="button" onClick={onDone}>Done</Button>}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="off" placeholder="name@company.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name-field">Name (optional)</Label>
              <Input id="invite-name-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} placeholder="Steve Ennis" />
            </div>
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Invitation["role"] })}
                options={ROLE_OPTIONS}
              />
            </div>
          )}
          <Button type="submit" disabled={create.isPending}>
            <Mail className="h-4 w-4 mr-1" />
            {create.isPending ? "Creating…" : "Create invitation link"}
          </Button>
        </form>
      )}

      {pending.length > 0 && (
        <section className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-medium">Waiting to be accepted</h4>
          <ul className="divide-y rounded-md border text-sm">
            {pending.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="min-w-0 truncate">
                  {i.name ? `${i.name} · ` : ""}{i.email}
                  <span className="ml-2 text-xs text-muted-foreground">{i.role.toLowerCase()}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-xs ${i.expired ? "text-destructive" : "text-muted-foreground"}`}>
                    {i.expired ? "expired" : `expires ${formatDateOnly(i.expiresAt, "short")}`}
                  </span>
                  <Button variant="ghost" size="sm" aria-label={`Withdraw invitation to ${i.email}`} onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

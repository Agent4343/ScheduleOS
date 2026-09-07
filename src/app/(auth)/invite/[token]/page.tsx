"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InviteDetails {
  email: string
  name: string | null
  role: string
  organizationName: string
}

const MIN_PASSWORD_LENGTH = 8

/**
 * Accepting an invitation: the invited person sets their own password, so an
 * administrator never has to invent one and read it out.
 */
export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) setLoadError(body?.error ?? "This invitation link is not valid.")
        else {
          setInvite(body.data)
          setName(body.data.name ?? "")
        }
      })
      .catch(() => !cancelled && setLoadError("Could not check this invitation. Check your connection and try again."))
    return () => {
      cancelled = true
    }
  }, [token])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (password !== confirm) {
      setFormError("The two passwords do not match.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(body?.error ?? "Could not set up your account.")
        return
      }
      router.push("/login?joined=1")
    } catch {
      setFormError("Could not set up your account. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link has expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            Invitation links last a week and can only be used once. Ask whoever invited you to send a new one.
          </p>
          <Link href="/login" className="text-sm underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (!invite) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Checking your invitation…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join {invite.organizationName}</CardTitle>
        <CardDescription>
          You have been invited as {invite.email}. Choose a password and you are in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-name">Your name</Label>
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-password">Choose a password</Label>
            <div className="flex gap-2">
              <Input
                id="invite-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              <Button type="button" variant="outline" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-confirm">Confirm password</Label>
            <Input
              id="invite-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Setting up your account…" : "Join"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

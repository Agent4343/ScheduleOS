"use client"

import { addDaysKey, todayKey, formatDateOnly } from "@/lib/dates"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeftRight,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Shield,
} from "lucide-react"

interface SwapRequest {
  id: string
  date: string
  shiftType: string
  reason: string | null
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "APPROVED" | "CANCELLED"
  adminNote: string | null
  createdAt: string
  requester: { id: string; name: string | null; email: string; crew?: { name: string; color: string } | null }
  target: { id: string; name: string | null; email: string; crew?: { name: string; color: string } | null }
}

interface Worker {
  id: string
  name: string | null
  email: string
  crew: { name: string; color: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Clock }> = {
  PENDING: { label: "Pending", variant: "secondary", icon: Clock },
  ACCEPTED: { label: "Accepted", variant: "default", icon: CheckCircle2 },
  DECLINED: { label: "Declined", variant: "destructive", icon: XCircle },
  APPROVED: { label: "Approved", variant: "default", icon: Shield },
  CANCELLED: { label: "Cancelled", variant: "outline", icon: XCircle },
}

export default function ShiftSwapsPage() {
  const { data: session } = useSession()
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [filter, setFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form state
  const [targetId, setTargetId] = useState("")
  const [swapDate, setSwapDate] = useState(() => addDaysKey(todayKey(), 1))
  const [swapShiftType, setSwapShiftType] = useState("DAY")
  const [swapReason, setSwapReason] = useState("")

  const currentUserId = (session?.user as { id?: string })?.id
  const userRole = (session?.user as { role?: string })?.role
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERVISOR"

  const fetchData = useCallback(async () => {
    try {
      const [swapsRes, workersRes] = await Promise.all([
        fetch("/api/shift-swaps"),
        fetch("/api/users?status=ACTIVE"),
      ])
      const swapsData = await swapsRes.json()
      if (swapsData.success) setSwaps(swapsData.data)
      const workersData = await workersRes.json()
      if (workersData.success) setWorkers(workersData.data)
    } catch {
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateSwap = async () => {
    if (!targetId || !swapDate) { setError("Select a worker and date"); return }
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/shift-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId,
          date: swapDate,
          shiftType: swapShiftType,
          reason: swapReason || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess("Swap request sent!")
        setShowForm(false)
        setTargetId("")
        setSwapReason("")
        await fetchData()
      } else {
        setError(data.error || "Failed to create swap request")
      }
    } catch { setError("Failed to create swap request") }
    finally { setSaving(false) }
  }

  const handleAction = async (swapId: string, action: string) => {
    setActionLoading(swapId)
    setError("")
    try {
      const res = await fetch(`/api/shift-swaps/${swapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(`Swap ${action}ed successfully`)
        await fetchData()
      } else {
        setError(data.error || `Failed to ${action} swap`)
      }
    } catch { setError(`Failed to ${action} swap`) }
    finally { setActionLoading(null) }
  }

  const filteredSwaps = swaps.filter(s => {
    if (filter === "all") return true
    if (filter === "mine") return s.requester.id === currentUserId
    if (filter === "incoming") return s.target.id === currentUserId
    return s.status === filter
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" />
            Shift Swaps
          </h1>
          <p className="text-muted-foreground text-sm">Request to swap shifts with other workers</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(""); setSuccess("") }} className="gap-2">
          <Plus className="h-4 w-4" />
          Request Swap
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* New Swap Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">New Swap Request</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <CardDescription>Choose who you want to swap with and for which date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="swap-target">Swap With *</Label>
                <select
                  id="swap-target"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                >
                  <option value="">Choose a worker...</option>
                  {workers.filter(w => w.id !== currentUserId).map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name || w.email}{w.crew ? ` (${w.crew.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="swap-date">Date *</Label>
                <Input id="swap-date" type="date" value={swapDate} onChange={e => setSwapDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swap-shift">Your Current Shift</Label>
                <select
                  id="swap-shift"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={swapShiftType}
                  onChange={e => setSwapShiftType(e.target.value)}
                >
                  <option value="DAY">Day Shift</option>
                  <option value="NIGHT">Night Shift</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="swap-reason">Reason (optional)</Label>
                <Input id="swap-reason" placeholder="e.g. Family event" value={swapReason} onChange={e => setSwapReason(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleCreateSwap} disabled={saving || !targetId} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
              Send Swap Request
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "mine", label: "My Requests" },
          { value: "incoming", label: "Incoming" },
          { value: "PENDING", label: "Pending" },
          { value: "ACCEPTED", label: "Accepted" },
          { value: "APPROVED", label: "Approved" },
        ].map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Swap List */}
      {filteredSwaps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No shift swap requests found</p>
            <p className="text-xs mt-1">Click &quot;Request Swap&quot; to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSwaps.map(swap => {
            const config = STATUS_CONFIG[swap.status]
            const StatusIcon = config.icon
            const isRequester = swap.requester.id === currentUserId
            const isTarget = swap.target.id === currentUserId
            const date = formatDateOnly(swap.date, "weekday")

            return (
              <Card key={swap.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {swap.requester.name || swap.requester.email}
                        </span>
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {swap.target.name || swap.target.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{date}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {swap.shiftType === "DAY" ? "Day" : "Night"}
                        </Badge>
                        <Badge variant={config.variant} className="text-xs gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {isRequester && <Badge variant="outline" className="text-xs">You requested</Badge>}
                        {isTarget && <Badge variant="outline" className="text-xs">Sent to you</Badge>}
                      </div>
                      {swap.reason && <p className="text-xs text-muted-foreground">{swap.reason}</p>}
                      {swap.adminNote && <p className="text-xs text-muted-foreground">Admin: {swap.adminNote}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Target can accept/decline pending swaps */}
                      {isTarget && swap.status === "PENDING" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAction(swap.id, "accept")}
                            disabled={actionLoading === swap.id}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(swap.id, "decline")}
                            disabled={actionLoading === swap.id}
                            className="gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Decline
                          </Button>
                        </>
                      )}

                      {/* Admin can approve accepted swaps */}
                      {isAdmin && swap.status === "ACCEPTED" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAction(swap.id, "approve")}
                            disabled={actionLoading === swap.id}
                            className="gap-1"
                          >
                            <Shield className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(swap.id, "cancel")}
                            disabled={actionLoading === swap.id}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {/* Requester can withdraw */}
                      {isRequester && ["PENDING", "ACCEPTED"].includes(swap.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(swap.id, "withdraw")}
                          disabled={actionLoading === swap.id}
                        >
                          Withdraw
                        </Button>
                      )}

                      {/* Admin can cancel any pending/accepted */}
                      {isAdmin && swap.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(swap.id, "cancel")}
                          disabled={actionLoading === swap.id}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How Shift Swaps Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">1. Request</p>
              <p>Choose a coworker and the date you want to swap. They&apos;ll be notified.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">2. Accept</p>
              <p>The other worker reviews and accepts or declines your request.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">3. Approve</p>
              <p>A supervisor or admin reviews and approves the swap. Schedules update automatically.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

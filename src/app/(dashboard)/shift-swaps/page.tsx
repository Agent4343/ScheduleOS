"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Modal } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowRightLeft, Loader2, Plus } from "lucide-react"
import { addDaysUTC, getTodayUTC, toDateString } from "@/lib/timezone"

interface SwapRequest {
  id: string
  date: string
  shiftType: string
  status: string
  reason?: string | null
  requester: { id: string; name: string | null; email: string }
  targetUser: { id: string; name: string | null; email: string }
  approvedBy?: { id: string; name: string | null } | null
}

interface UserOption {
  id: string
  name: string | null
  email: string
}

interface ScheduleEntry {
  id: string
  date: string
  shiftType: string
}

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "DENIED", label: "Denied" },
  { value: "CANCELLED", label: "Cancelled" },
]

export default function ShiftSwapsPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([])
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    date: "",
    targetUserId: "",
    reason: "",
  })

  const dateRange = useMemo(() => {
    const start = getTodayUTC()
    const end = addDaysUTC(start, 30)
    return { startDate: toDateString(start), endDate: toDateString(end) }
  }, [])

  const fetchRequests = async () => {
    setLoading(true)
    setFeedback(null)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ""
      const response = await fetch(`/api/shift-swaps${params}`)
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load shift swaps")
      }
      setRequests(data.data || [])
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to load shift swaps" })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()
      if (data.success) {
        setUsers(data.data.filter((user: UserOption) => user.id !== session?.user?.id))
      }
    } catch (err) {
      console.error("Failed to load users:", err)
    }
  }

  const fetchSchedule = async () => {
    if (!session?.user?.id) return
    try {
      const response = await fetch(
        `/api/schedules?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&userId=${session.user.id}`
      )
      const data = await response.json()
      if (data.success) {
        setScheduleEntries(data.data || [])
      }
    } catch (err) {
      console.error("Failed to load schedule:", err)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchUsers()
    fetchSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, session?.user?.id])

  const handleSubmit = async () => {
    if (!formData.date || !formData.targetUserId) {
      setFeedback({ type: "error", message: "Date and target worker are required." })
      return
    }

    setSubmitting(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/shift-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to request swap")
      }
      setShowModal(false)
      setFormData({ date: "", targetUserId: "", reason: "" })
      await fetchRequests()
      setFeedback({ type: "success", message: "Shift swap requested." })
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to request swap" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (requestId: string, status: "APPROVED" | "DENIED" | "CANCELLED") => {
    setFeedback(null)
    try {
      const response = await fetch(`/api/shift-swaps/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update request")
      }
      await fetchRequests()
      setFeedback({ type: "success", message: `Request ${status.toLowerCase()}.` })
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to update request" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Swaps"
        description="Request and manage shift swap approvals."
        actions={(
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Request Swap
          </Button>
        )}
      />

      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertTitle>{feedback.type === "error" ? "Action failed" : "Success"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Swap Requests
          </CardTitle>
          <CardDescription>Track approvals and swap outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="statusFilter" className="text-sm">Filter</Label>
            <Select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="w-44"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No shift swap requests found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>{new Date(request.date).toLocaleDateString()}</TableCell>
                    <TableCell>{request.shiftType}</TableCell>
                    <TableCell>{request.requester.name || request.requester.email}</TableCell>
                    <TableCell>{request.targetUser.name || request.targetUser.email}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === "PENDING" ? "secondary" : "default"}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.reason || "-"}
                    </TableCell>
                    <TableCell className="space-x-2">
                      {request.status === "PENDING" && isAdmin && (
                        <>
                          <Button size="sm" onClick={() => handleUpdateStatus(request.id, "APPROVED")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(request.id, "DENIED")}>
                            Deny
                          </Button>
                        </>
                      )}
                      {request.status === "PENDING" && request.requester.id === session?.user?.id && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(request.id, "CANCELLED")}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Request Shift Swap">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="swapDate">Date</Label>
            <Select
              id="swapDate"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              options={[
                { value: "", label: "Select a date" },
                ...scheduleEntries.map((entry) => {
                  const dateValue = toDateString(new Date(entry.date))
                  return {
                    value: dateValue,
                    label: `${new Date(entry.date).toLocaleDateString()} (${entry.shiftType})`,
                  }
                }),
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetUser">Swap With</Label>
            <Select
              id="targetUser"
              value={formData.targetUserId}
              onChange={(e) => setFormData((prev) => ({ ...prev, targetUserId: e.target.value }))}
              options={[
                { value: "", label: "Select a worker" },
                ...users.map((user) => ({
                  value: user.id,
                  label: user.name ? `${user.name} (${user.email})` : user.email,
                })),
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Add a note for the approver"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Swap"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

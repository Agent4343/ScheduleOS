"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CalendarOff,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react"
import { TimeOffType, RequestStatus } from "@/types"

interface TimeOffRequest {
  id: string
  startDate: string
  endDate: string
  type: TimeOffType
  status: RequestStatus
  reason: string | null
  user: {
    id: string
    name: string | null
    email: string
    crew: { name: string } | null
  }
  approvedBy: { name: string | null } | null
  createdAt: string
}

const STATUS_CONFIG: Record<RequestStatus, { color: string; icon: React.ReactNode }> = {
  PENDING: { color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  APPROVED: { color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  DENIED: { color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
  CANCELLED: { color: "bg-gray-100 text-gray-800", icon: <XCircle className="h-3 w-3" /> },
}

const TYPE_LABELS: Record<TimeOffType, string> = {
  VACATION: "Vacation",
  SICK: "Sick Leave",
  PERSONAL: "Personal",
  BEREAVEMENT: "Bereavement",
  JURY_DUTY: "Jury Duty",
  OTHER: "Other",
}

export default function TimeOffPage() {
  const { data: session } = useSession()
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "VACATION" as TimeOffType,
    reason: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  useEffect(() => {
    async function fetchRequests() {
      try {
        let url = "/api/time-off"
        if (statusFilter) {
          url += `?status=${statusFilter}`
        }

        const response = await fetch(url)
        const data = await response.json()

        if (data.success) {
          setRequests(data.data)
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
  }, [statusFilter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setRequests((prev) => [data.data, ...prev])
        setIsModalOpen(false)
        setFormData({
          startDate: "",
          endDate: "",
          type: "VACATION",
          reason: "",
        })
      } else {
        alert(data.error || "Failed to submit request")
      }
    } catch (error) {
      console.error("Failed to submit request:", error)
      alert("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateStatus(requestId: string, status: "APPROVED" | "DENIED") {
    try {
      const response = await fetch(`/api/time-off?id=${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()

      if (data.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status } : r))
        )
      } else {
        alert(data.error || "Failed to update request")
      }
    } catch (error) {
      console.error("Failed to update request:", error)
      alert("Failed to update request")
    }
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Off Requests</h1>
          <p className="text-muted-foreground">
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}`
              : "No pending requests"}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "", label: "All Status" },
            { value: "PENDING", label: "Pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "DENIED", label: "Denied" },
          ]}
          className="w-36"
        />
      </div>

      {/* Requests table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5" />
            All Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time off requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.user.name || request.user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.user.crew?.name || "Unassigned"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[request.type]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{new Date(request.startDate).toLocaleDateString()}</p>
                        <p className="text-muted-foreground">
                          to {new Date(request.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[request.status].color}>
                        {STATUS_CONFIG[request.status].icon}
                        <span className="ml-1">{request.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {request.status === "PENDING" && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleUpdateStatus(request.id, "APPROVED")}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleUpdateStatus(request.id, "DENIED")}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Deny
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Time Off"
        description="Submit a new time off request"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type of Leave</Label>
            <Select
              value={formData.type}
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as TimeOffType }))}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Brief description..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

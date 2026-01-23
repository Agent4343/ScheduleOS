"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, Filter, Loader2, AlertTriangle } from "lucide-react"
import { endOfWeekUTC, getTodayUTC, startOfWeekUTC, toDateString } from "@/lib/timezone"

interface GapWorker {
  id: string
  name: string | null
  crewName: string | null
  role: string
  positionType: string
}

interface StaffingGap {
  date: string
  shiftType: string
  shortage: number
  required: number
  scheduled: number
  ruleName: string
  crew?: { id: string; name: string }
  positionType?: string
  role?: string
  scheduledWorkers: GapWorker[]
  availableWorkers: GapWorker[]
}

interface Crew {
  id: string
  name: string
}

const ROLE_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "WORKER", label: "Worker" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "ADMIN", label: "Administrator" },
]

const SHIFT_OPTIONS = [
  { value: "", label: "All Shifts" },
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
]

const POSITION_OPTIONS = [
  { value: "", label: "All Positions" },
  { value: "OPERATOR", label: "Operator" },
  { value: "ONSHORE_CONTROL_ROOM", label: "Onshore Control Room" },
  { value: "OTHER", label: "Other" },
]

export default function StaffingGapsPage() {
  const { data: session } = useSession()
  const today = useMemo(() => getTodayUTC(), [])
  const [startDate, setStartDate] = useState(() => toDateString(startOfWeekUTC(today)))
  const [endDate, setEndDate] = useState(() => toDateString(endOfWeekUTC(today)))
  const [crewId, setCrewId] = useState("")
  const [shiftType, setShiftType] = useState("")
  const [role, setRole] = useState("")
  const [positionType, setPositionType] = useState("")
  const [crews, setCrews] = useState<Crew[]>([])
  const [gaps, setGaps] = useState<StaffingGap[]>([])
  const [totalGaps, setTotalGaps] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPERVISOR"

  useEffect(() => {
    async function fetchCrews() {
      try {
        const response = await fetch("/api/crews")
        const data = await response.json()
        if (data.success) {
          setCrews(data.data)
        }
      } catch (err) {
        console.error("Failed to load crews:", err)
      }
    }
    fetchCrews()
  }, [])

  const fetchGaps = useCallback(async () => {
    setLoading(true)
    setError(null)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })
      if (crewId) params.set("crewId", crewId)
      if (shiftType) params.set("shiftType", shiftType)
      if (role) params.set("role", role)
      if (positionType) params.set("positionType", positionType)

      const response = await fetch(`/api/staffing-gaps?${params.toString()}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch staffing gaps.")
      }

      setGaps(data.data.gaps || [])
      setTotalGaps(data.data.totalGaps || 0)
      setTotalDays(data.data.totalDays || 0)
    } catch (err) {
      console.error("Failed to load staffing gaps:", err)
      setError(err instanceof Error ? err.message : "Failed to load staffing gaps.")
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, crewId, shiftType, role, positionType])

  const getGapKey = (gap: StaffingGap) => {
    return [
      gap.date,
      gap.shiftType,
      gap.ruleName,
      gap.crew?.id || "org",
      gap.positionType || "any",
      gap.role || "any",
    ].join("|")
  }

  const handleAssign = async (gap: StaffingGap) => {
    if (!isAdmin) {
      setFeedback({ type: "error", message: "Only admins and supervisors can assign coverage." })
      return
    }

    const key = getGapKey(gap)
    const selectedWorkerId = assignSelections[key]
    if (!selectedWorkerId) {
      setFeedback({ type: "error", message: "Select a worker before assigning coverage." })
      return
    }

    setAssigning((prev) => ({ ...prev, [key]: true }))
    setFeedback(null)

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedWorkerId,
          date: gap.date,
          shiftType: gap.shiftType,
          isOverride: true,
          overrideReason: `Staffing gap coverage: ${gap.ruleName}`,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to assign worker.")
      }

      setFeedback({ type: "success", message: "Coverage assigned successfully." })
      await fetchGaps()
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to assign worker.",
      })
    } finally {
      setAssigning((prev) => ({ ...prev, [key]: false }))
    }
  }

  useEffect(() => {
    fetchGaps()
  }, [fetchGaps])

  const handleExport = () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      format: "csv",
    })
    if (crewId) params.set("crewId", crewId)
    if (shiftType) params.set("shiftType", shiftType)
    if (role) params.set("role", role)
    if (positionType) params.set("positionType", positionType)
    window.location.href = `/api/staffing-gaps?${params.toString()}`
  }

  const crewFilterActive = Boolean(crewId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staffing Gaps"
        description="Identify where coverage falls below minimum staffing requirements."
        actions={(
          <Button variant="outline" className="gap-2" onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter staffing gaps by date range and scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crewFilter">Crew</Label>
              <Select
                id="crewFilter"
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                options={[
                  { value: "", label: "All Crews" },
                  ...crews.map((crew) => ({ value: crew.id, label: crew.name })),
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shiftFilter">Shift</Label>
              <Select
                id="shiftFilter"
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                options={SHIFT_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleFilter">Role</Label>
              <Select
                id="roleFilter"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={ROLE_OPTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="positionFilter">Position</Label>
              <Select
                id="positionFilter"
                value={positionType}
                onChange={(e) => setPositionType(e.target.value)}
                options={POSITION_OPTIONS}
              />
            </div>
          </div>

          {crewFilterActive ? (
            <Alert variant="info">
              <AlertTitle>Crew filter applied</AlertTitle>
              <AlertDescription>
                Crew filtering only shows gaps from crew-specific rules. Organization-wide minimums are hidden.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={fetchGaps} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Filters"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load staffing gaps</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertTitle>{feedback.type === "error" ? "Action failed" : "Success"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Gaps</CardDescription>
            <CardTitle className="text-2xl">{totalGaps}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Date Range</CardDescription>
            <CardTitle className="text-2xl">
              {startDate} → {endDate}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Days</CardDescription>
            <CardTitle className="text-2xl">{totalDays}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Gap Details
          </CardTitle>
          <CardDescription>Review exactly who is scheduled and who can cover each gap.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No staffing gaps found for this range.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Shortage</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map((gap, index) => (
                  <TableRow key={`${gap.date}-${gap.shiftType}-${index}`}>
                    <TableCell>{new Date(gap.date).toLocaleDateString()}</TableCell>
                    <TableCell>{gap.shiftType}</TableCell>
                    <TableCell>{gap.ruleName}</TableCell>
                    <TableCell>{gap.required}</TableCell>
                    <TableCell>{gap.scheduled}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">-{gap.shortage}</Badge>
                    </TableCell>
                    <TableCell>{gap.crew?.name || "Org-wide"}</TableCell>
                    <TableCell>{gap.positionType || "Any"}</TableCell>
                    <TableCell>{gap.role || "Any"}</TableCell>
                    <TableCell>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary">View</summary>
                        <div className="mt-2 space-y-1 text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Scheduled:</span>{" "}
                            {gap.scheduledWorkers.length > 0
                              ? gap.scheduledWorkers.map((w) => w.name || "Unnamed").join(", ")
                              : "None"}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">Available:</span>{" "}
                            {gap.availableWorkers.length > 0
                              ? gap.availableWorkers.map((w) => w.name || "Unnamed").join(", ")
                              : "None"}
                          </p>
                          {isAdmin ? (
                            <div className="pt-2 space-y-2">
                              <Label htmlFor={`assign-${index}`} className="text-xs">Assign coverage</Label>
                              <Select
                                id={`assign-${index}`}
                                value={assignSelections[getGapKey(gap)] || ""}
                                onChange={(e) =>
                                  setAssignSelections((prev) => ({
                                    ...prev,
                                    [getGapKey(gap)]: e.target.value,
                                  }))
                                }
                                options={[
                                  { value: "", label: "Select worker" },
                                  ...gap.availableWorkers.map((worker) => ({
                                    value: worker.id,
                                    label: worker.name
                                      ? `${worker.name}${worker.crewName ? ` (${worker.crewName})` : ""}`
                                      : worker.id,
                                  })),
                                ]}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAssign(gap)}
                                disabled={assigning[getGapKey(gap)] || gap.availableWorkers.length === 0}
                              >
                                {assigning[getGapKey(gap)] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Assign"
                                )}
                              </Button>
                              {gap.availableWorkers.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No available workers match this rule.</p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground pt-2">
                              Only supervisors and admins can assign coverage.
                            </p>
                          )}
                        </div>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

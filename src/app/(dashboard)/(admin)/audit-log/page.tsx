"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Calendar,
  Settings,
  ArrowLeftRight,
  Megaphone,
  Upload,
} from "lucide-react"

interface AuditEntry {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  /** Null once that account has been deleted — the entry itself remains */
  user: { id: string; name: string | null; email: string; role: string } | null
  /** Who it was, captured when it happened */
  actorName: string | null
  actorEmail: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof User; color: string }> = {
  USER_CREATED: { label: "User Created", icon: User, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  USER_UPDATED: { label: "User Updated", icon: User, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  USER_DELETED: { label: "User Deleted", icon: User, color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  TIME_OFF_APPROVED: { label: "Time-Off Approved", icon: Calendar, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  TIME_OFF_DENIED: { label: "Time-Off Denied", icon: Calendar, color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  SCHEDULE_OVERRIDE: { label: "Schedule Override", icon: Calendar, color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  SCHEDULE_GENERATED: { label: "Schedule Generated", icon: Calendar, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  CREW_CREATED: { label: "Crew Created", icon: Users, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  CREW_UPDATED: { label: "Crew Updated", icon: Users, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  CREW_DELETED: { label: "Crew Deleted", icon: Users, color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  ORGANIZATION_UPDATED: { label: "Settings Updated", icon: Settings, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  ROLE_CHANGED: { label: "Role Changed", icon: Shield, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  SHIFT_SWAP_APPROVED: { label: "Shift Swap Approved", icon: ArrowLeftRight, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  ANNOUNCEMENT_CREATED: { label: "Announcement Posted", icon: Megaphone, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  WORKER_IMPORTED: { label: "Workers Imported", icon: Upload, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  STAFFING_RULE_CHANGED: { label: "Staffing Rule Changed", icon: Shield, color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
}

const DEFAULT_ACTION = { label: "Action", icon: Shield, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" }

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  const fetchLogs = useCallback(async (page: number, action?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" })
      if (action) params.set("action", action)
      const res = await fetch(`/api/audit-log?${params}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.data)
        setPagination(data.pagination)
      }
    } catch {
      console.error("Failed to fetch audit logs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchLogs(1, filter || undefined) }, [fetchLogs, filter])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Audit Log
        </h1>
        <p className="text-muted-foreground text-sm">Track all administrative actions and changes</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={!filter ? "default" : "outline"} size="sm" onClick={() => setFilter("")}>All</Button>
        {["USER_CREATED", "USER_UPDATED", "ROLE_CHANGED", "TIME_OFF_APPROVED", "SCHEDULE_OVERRIDE", "SHIFT_SWAP_APPROVED", "CREW_CREATED"].map(action => {
          const config = ACTION_CONFIG[action] || DEFAULT_ACTION
          return (
            <Button key={action} variant={filter === action ? "default" : "outline"} size="sm" onClick={() => setFilter(action)}>
              {config.label}
            </Button>
          )
        })}
      </div>

      {/* Log entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {pagination.total} event{pagination.total !== 1 ? "s" : ""} recorded
          </CardTitle>
          <CardDescription>Page {pagination.page} of {pagination.totalPages || 1}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No audit log entries found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => {
                const config = ACTION_CONFIG[log.action] || DEFAULT_ACTION
                const ActionIcon = config.icon
                const time = new Date(log.createdAt)

                return (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className={`p-1.5 rounded-md ${config.color}`}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
                        <span className="text-sm font-medium">
                          {log.user?.name || log.user?.email || log.actorName || log.actorEmail || "Unknown"}
                        </span>
                        {log.user ? (
                          <Badge variant="outline" className="text-xs">{log.user.role}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs" title="This account has since been deleted; the entry is kept">
                            deleted account
                          </Badge>
                        )}
                      </div>
                      {log.targetType && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Target: {log.targetType}{log.targetId ? ` (${log.targetId.slice(0, 8)}...)` : ""}
                        </p>
                      )}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                      <p>{time.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      <p>{time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1, filter || undefined)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLogs(pagination.page + 1, filter || undefined)}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

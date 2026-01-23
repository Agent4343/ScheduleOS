"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Shield } from "lucide-react"

interface AuditLogEntry {
  id: string
  action: string
  targetId?: string | null
  targetType?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/audit-logs")
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load audit logs")
        }
        setLogs(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs")
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track critical actions across your organization."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load logs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recent Events
          </CardTitle>
          <CardDescription>Latest 200 events recorded.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No audit log events recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{log.user.name || log.user.email}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      {log.targetType ? `${log.targetType}: ${log.targetId ?? "-"}` : "-"}
                    </TableCell>
                    <TableCell>{log.ipAddress || "-"}</TableCell>
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

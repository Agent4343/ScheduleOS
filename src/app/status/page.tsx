"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, ShieldCheck } from "lucide-react"

interface HealthStatus {
  status: string
  timestamp: string
  database?: string
  error?: string
}

export default function StatusPage() {
  const [status, setStatus] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch status")
        }
        setStatus(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch status")
      }
    }

    fetchStatus()
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ShiftSync Status</h1>
        <p className="text-muted-foreground">Live system health indicators.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Status unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Updated {status?.timestamp ? new Date(status.timestamp).toLocaleString() : "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          {!status && !error ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : status ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Status</span>
                <Badge variant={status.status === "healthy" ? "success" : "destructive"}>
                  {status.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Database</span>
                <Badge variant={status.database === "connected" ? "success" : "warning"}>
                  {status.database || "unknown"}
                </Badge>
              </div>
              {status.error ? (
                <p className="text-sm text-destructive">{status.error}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

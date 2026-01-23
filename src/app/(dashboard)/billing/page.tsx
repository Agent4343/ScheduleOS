"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CreditCard, Loader2, ArrowUpRight } from "lucide-react"

interface BillingSettings {
  plan?: string
  status?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: string
  trialEndsAt?: string
  seatCount?: number
  requestedPlan?: string
}

interface OrganizationData {
  id: string
  name: string
  settings?: Record<string, unknown>
  _count?: {
    users: number
    crews: number
    rotationPatterns: number
  }
}

export default function BillingPage() {
  const [organization, setOrganization] = useState<OrganizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchOrganization = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/organization")
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load organization")
      }
      setOrganization(data.data)
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load billing details",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganization()
  }, [])

  const billing: BillingSettings = organization?.settings?.billing as BillingSettings || {}
  const planLabel = billing.plan ? billing.plan.toUpperCase() : "FREE"
  const statusLabel = billing.status ? billing.status.replace("_", " ") : "Not subscribed"

  const handleOpenPortal = async () => {
    setPortalLoading(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to open portal")
      }
      window.location.href = data.url
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to open billing portal",
      })
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and billing details."
        actions={(
          <Button variant="outline" asChild>
            <a href="/pricing">
              View Plans
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      />

      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "success"}>
          <AlertTitle>{feedback.type === "error" ? "Billing error" : "Success"}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Track your subscription status and renewal date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">{planLabel}</Badge>
                <Badge variant={billing.status === "active" ? "success" : "outline"}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                <div>
                  <span className="font-medium text-foreground">Seats:</span>{" "}
                  {billing.seatCount || organization?._count?.users || 0}
                </div>
                <div>
                  <span className="font-medium text-foreground">Renewal:</span>{" "}
                  {billing.currentPeriodEnd
                    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Trial ends:</span>{" "}
                  {billing.trialEndsAt ? new Date(billing.trialEndsAt).toLocaleDateString() : "—"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Requested plan:</span>{" "}
                  {billing.requestedPlan ? billing.requestedPlan.toUpperCase() : "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleOpenPortal} disabled={!billing.stripeCustomerId || portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage Billing"}
                </Button>
                <Button variant="outline" asChild>
                  <a href="/pricing">Change Plan</a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

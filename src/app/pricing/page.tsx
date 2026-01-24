"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$8",
    description: "Core scheduling, staffing, and time-off controls.",
    features: [
      "Schedules + rotations",
      "Staffing alerts + coverage",
      "Time-off approvals",
      "Audit logs",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    description: "Advanced operations, reporting, and support.",
    features: [
      "Everything in Starter",
      "Shift swap workflow",
      "Custom shift types",
      "Priority support",
    ],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "Large teams with bespoke support and security needs.",
    features: [
      "Everything in Pro",
      "Dedicated onboarding",
      "Custom integrations",
      "Enterprise security",
    ],
  },
]

interface OrganizationCounts {
  users: number
}

export default function PricingPage() {
  const { data: session } = useSession()
  const [seatCount, setSeatCount] = useState(1)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [counts, setCounts] = useState<OrganizationCounts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    const fetchCounts = async () => {
      try {
        const response = await fetch("/api/organization")
        const data = await response.json()
        if (data.success && data.data?._count) {
          setCounts({ users: data.data._count.users })
          setSeatCount(data.data._count.users || 1)
        }
      } catch (error) {
        console.error("Failed to load org counts:", error)
      }
    }
    fetchCounts()
  }, [session?.user])

  const handleCheckout = async (plan: string) => {
    if (!session?.user) {
      window.location.href = "/register"
      return
    }

    setLoadingPlan(plan)
    setError(null)
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          quantity: seatCount,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to start checkout")
      }
      window.location.href = data.url
    } catch (error) {
      console.error("Checkout error:", error)
      setLoadingPlan(null)
      setError(error instanceof Error ? error.message : "Failed to start checkout")
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
      <div className="text-center space-y-3">
        <Badge variant="secondary">ShiftSync Plans</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Flexible pricing for every team</h1>
        <p className="text-muted-foreground">
          Pick a plan that scales with your scheduling needs.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Checkout failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <div className="text-sm text-muted-foreground">
          {counts ? `Active workers: ${counts.users}` : "Set your seat count"}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value) || 1)}
            className="w-24 text-center"
          />
          <span className="text-sm text-muted-foreground">seats</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={plan.highlight ? "border-primary shadow-md" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {plan.name}
                {plan.highlight ? <Badge>Most Popular</Badge> : null}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">{plan.price}<span className="text-base font-normal text-muted-foreground">/seat</span></div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.highlight ? "default" : "outline"}
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start trial"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Questions? <a href="/support" className="text-primary underline">Contact support</a>
      </div>
    </div>
  )
}

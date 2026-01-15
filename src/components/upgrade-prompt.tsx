"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Zap, Lock } from "lucide-react"

interface UpgradePromptProps {
  feature: string
  description?: string
  variant?: "card" | "inline" | "banner"
}

export function UpgradePrompt({
  feature,
  description,
  variant = "card",
}: UpgradePromptProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>{feature} requires an upgrade.</span>
        <Link href="/billing" className="text-primary hover:underline">
          Upgrade now
        </Link>
      </div>
    )
  }

  if (variant === "banner") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{feature}</p>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/billing">Upgrade</Link>
        </Button>
      </div>
    )
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="rounded-full bg-primary/10 p-3 mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold mb-2">{feature}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description || "Upgrade your plan to unlock this feature."}
        </p>
        <Button asChild>
          <Link href="/billing">
            <Zap className="mr-2 h-4 w-4" />
            Upgrade Now
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

// Component to wrap content that should be hidden/disabled based on plan
interface PlanGateProps {
  children: React.ReactNode
  feature: string
  description?: string
  hasAccess: boolean
  fallback?: React.ReactNode
}

export function PlanGate({
  children,
  feature,
  description,
  hasAccess,
  fallback,
}: PlanGateProps) {
  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return <UpgradePrompt feature={feature} description={description} />
}

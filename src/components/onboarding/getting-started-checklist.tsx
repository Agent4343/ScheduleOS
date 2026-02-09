"use client"

import { useOnboarding } from "@/contexts/onboarding-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Circle,
  Users,
  Users2,
  Calendar,
  Settings,
  ArrowRight,
  Sparkles,
  RotateCw,
  X,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

interface ChecklistItem {
  id: keyof typeof checklistConfig
  title: string
  description: string
  href: string
  icon: React.ElementType
}

const checklistConfig = {
  addWorkers: {
    title: "Add your workers",
    description: "Add employees who need shift scheduling",
    href: "/workers",
    icon: Users,
  },
  createCrews: {
    title: "Create crews",
    description: "Group workers into teams for rotation patterns",
    href: "/crews",
    icon: Users2,
  },
  setupPatterns: {
    title: "Set up rotation patterns",
    description: "Define shift patterns like 14 on/14 off",
    href: "/settings",
    icon: Settings,
  },
  generateSchedules: {
    title: "Generate schedules",
    description: "Use the Setup wizard to create schedules",
    href: "/setup",
    icon: Calendar,
  },
} as const

export function GettingStartedChecklist() {
  const { state, loading, refreshOnboarding } = useOnboarding()
  const [dismissed, setDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Don't render if loading, no state, complete, or dismissed
  if (loading || !state || state.isOnboardingComplete || dismissed) {
    return null
  }

  const progress = (state.completedSteps / state.totalSteps) * 100

  const checklistItems: ChecklistItem[] = Object.entries(checklistConfig).map(
    ([id, config]) => ({
      id: id as keyof typeof checklistConfig,
      ...config,
    })
  )

  // Find next incomplete step
  const nextStep = checklistItems.find(
    (item) => !state.checklist[item.id]
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshOnboarding()
    setRefreshing(false)
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RotateCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Complete these steps to set up your scheduling system
        </CardDescription>
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {state.completedSteps} of {state.totalSteps} complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklistItems.map((item) => {
          const isComplete = state.checklist[item.id]
          const isNext = nextStep?.id === item.id

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`
                flex items-center gap-3 p-3 rounded-lg border transition-all
                ${isComplete
                  ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                  : isNext
                    ? "bg-primary/5 border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                    : "bg-background hover:bg-accent"
                }
              `}
            >
              <div className="shrink-0">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className={`h-5 w-5 ${isNext ? "text-primary" : "text-muted-foreground"}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <item.icon className={`h-4 w-4 ${isComplete ? "text-green-600" : isNext ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`font-medium ${isComplete ? "text-green-700 dark:text-green-400 line-through" : ""}`}>
                    {item.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
              {isNext && (
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
              )}
            </Link>
          )
        })}

        {nextStep && (
          <div className="pt-2">
            <Link href={nextStep.href}>
              <Button className="w-full gap-2">
                <nextStep.icon className="h-4 w-4" />
                {nextStep.title}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

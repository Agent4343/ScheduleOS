"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, Users2, Users, RefreshCw, Calendar, Bell, ArrowRight, Loader2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, LinkButton } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { errorMessage } from "@/lib/api-client"
import type { Crew } from "@/features/types"
import { useSetupStatus } from "@/features/onboarding/hooks"
import { useCrews, useCreateCrew } from "@/features/crews/hooks"
import { useCreateWorker } from "@/features/workers/hooks"
import { useRotationPatterns } from "@/features/rotation-patterns/hooks"
import { CrewForm, type CrewFormValues } from "@/features/crews/components/crew-form"
import { WorkerForm, type WorkerFormValues } from "@/features/workers/components/worker-form"
import { GenerateScheduleDialog } from "@/features/schedules/components/generate-schedule-dialog"

type Dialog = { kind: "crew" } | { kind: "worker" } | { kind: "generate"; crew: Crew } | null

interface Step {
  key: string
  done: boolean
  icon: typeof Users2
  title: string
  detail: string
  action: ReactNode
}

/**
 * Onboarding is a checklist, not a second copy of every form. Each step
 * either opens the same dialog the real page uses, or links to that page.
 */
export default function GettingStartedPage() {
  const toast = useToast()
  const status = useSetupStatus()
  const crews = useCrews()
  const patterns = useRotationPatterns()
  const createCrew = useCreateCrew()
  const createWorker = useCreateWorker()
  const [dialog, setDialog] = useState<Dialog>(null)

  const s = status.data
  const crewList = crews.data ?? []
  const patternList = patterns.data ?? []
  const crewsWithPattern = crewList.filter((c) => c.rotationPattern)

  const addCrew = async (values: CrewFormValues) => {
    try {
      await createCrew.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        color: values.color,
        rotationPatternId: values.rotationPatternId || undefined,
      })
      toast.success(`Crew ${values.name} created`)
      setDialog(null)
      status.refetch()
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create crew"))
    }
  }

  const addWorker = async (values: WorkerFormValues) => {
    try {
      await createWorker.mutateAsync({
        name: values.name,
        email: values.email,
        role: values.role,
        position: values.position || undefined,
        phone: values.phone || undefined,
        crewId: values.crewId || undefined,
        hireDate: values.hireDate || undefined,
        password: values.password,
      })
      toast.success(`${values.name} added`)
      setDialog(null)
      status.refetch()
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add worker"))
    }
  }

  if (status.isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (status.isError || !s) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {errorMessage(status.error, "Could not load setup status")}{" "}
          <button className="underline" onClick={() => status.refetch()}>
            Retry
          </button>
        </AlertDescription>
      </Alert>
    )
  }

  const steps: Step[] = [
    {
      key: "patterns",
      done: s.hasPatterns,
      icon: RefreshCw,
      title: "Define a rotation pattern",
      detail: s.hasPatterns
        ? `${s.patternCount} pattern(s): ${patternList.slice(0, 3).map((p) => `${p.name} (${p.daysOn}/${p.daysOff})`).join(", ")}`
        : "How many days on, how many off, and whether nights are worked.",
      action: (
        <LinkButton href="/settings" variant={s.hasPatterns ? "outline" : "default"} size="sm">
          {s.hasPatterns ? "Manage patterns" : "Create a pattern"} <ArrowRight className="h-4 w-4 ml-1" />
        </LinkButton>
      ),
    },
    {
      key: "crews",
      done: s.hasCrews,
      icon: Users2,
      title: "Create crews",
      detail: s.hasCrews ? `${s.crewCount} crew(s): ${crewList.map((c) => c.name).join(", ")}` : "A crew is a group of workers who share one rotation.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={s.hasCrews ? "outline" : "default"} onClick={() => setDialog({ kind: "crew" })}>
            <Plus className="h-4 w-4 mr-1" /> Add crew
          </Button>
          {s.hasCrews && (
            <LinkButton href="/crews" variant="ghost" size="sm">
              Open Crews <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
          )}
        </div>
      ),
    },
    {
      key: "workers",
      done: s.hasWorkers,
      icon: Users,
      title: "Add workers to crews",
      detail: s.hasWorkers ? `${s.workerCount} worker(s) added` : "Each worker gets a temporary password to sign in with.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={s.hasWorkers ? "outline" : "default"} onClick={() => setDialog({ kind: "worker" })} disabled={!s.hasCrews}>
            <Plus className="h-4 w-4 mr-1" /> Add worker
          </Button>
          {s.hasWorkers && (
            <LinkButton href="/workers" variant="ghost" size="sm">
              Open Workers <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
          )}
        </div>
      ),
    },
    {
      key: "schedules",
      done: s.hasSchedules,
      icon: Calendar,
      title: "Generate each crew's schedule",
      detail: crewsWithPattern.length
        ? "The first generation fixes a crew's rotation; later ones extend it."
        : "Assign a rotation pattern to a crew first (Crews → Configure).",
      action: (
        <div className="flex flex-wrap gap-2">
          {crewsWithPattern.map((crew) => (
            <Button
              key={crew.id}
              size="sm"
              variant={crew.rotationAnchorDate ? "outline" : "default"}
              onClick={() => setDialog({ kind: "generate", crew })}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {crew.rotationAnchorDate ? `Extend ${crew.name}` : `Generate ${crew.name}`}
            </Button>
          ))}
          {s.hasSchedules && (
            <LinkButton href="/schedule" variant="ghost" size="sm">
              View schedule <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
          )}
        </div>
      ),
    },
    {
      key: "staffing",
      done: false,
      icon: Bell,
      title: "Set minimum staffing (optional)",
      detail: "Get warned when a shift drops below the number of people it needs.",
      action: (
        <LinkButton href="/settings" variant="outline" size="sm">
          Staffing rules <ArrowRight className="h-4 w-4 ml-1" />
        </LinkButton>
      ),
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Getting Started</h1>
        <p className="text-muted-foreground">
          {s.isComplete ? "Your organization is set up. You can revisit any step here." : `${s.completedSteps} of ${s.totalSteps} setup steps done.`}
        </p>
      </div>

      <div
        className="h-2 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuenow={s.completedSteps}
        aria-valuemin={0}
        aria-valuemax={s.totalSteps}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${(s.completedSteps / s.totalSteps) * 100}%` }} />
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.key}>
              <Card className={cn(step.done && "border-green-500/40")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {step.done ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" aria-label="Done" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground shrink-0" aria-label="Not done" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-muted-foreground font-normal">{i + 1}.</span>
                        <Icon className="h-4 w-4" aria-hidden />
                        {step.title}
                      </CardTitle>
                      <CardDescription>{step.detail}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pl-14">{step.action}</CardContent>
              </Card>
            </li>
          )
        })}
      </ol>

      {s.isComplete && (
        <p className="text-sm text-muted-foreground">
          All set. Head to the{" "}
          <Link href="/dashboard" className="underline">
            dashboard
          </Link>
          .
        </p>
      )}

      <Modal isOpen={dialog?.kind === "crew"} onClose={() => setDialog(null)} title="Add Crew">
        <CrewForm patterns={patternList} submitting={createCrew.isPending} onSubmit={addCrew} onCancel={() => setDialog(null)} />
      </Modal>

      <Modal isOpen={dialog?.kind === "worker"} onClose={() => setDialog(null)} title="Add Worker">
        <WorkerForm crews={crewList} submitting={createWorker.isPending} onSubmit={addWorker} onCancel={() => setDialog(null)} />
      </Modal>

      <GenerateScheduleDialog
        key={dialog?.kind === "generate" ? dialog.crew.id : "none"}
        open={dialog?.kind === "generate"}
        onClose={() => setDialog(null)}
        target={dialog?.kind === "generate" ? { kind: "crew", crew: dialog.crew } : null}
        defaultMonths={12}
        onGenerated={() => status.refetch()}
      />
    </div>
  )
}

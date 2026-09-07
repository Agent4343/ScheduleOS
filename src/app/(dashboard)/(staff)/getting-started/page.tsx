"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, Users2, Users, RefreshCw, Calendar, ArrowRight, Loader2, Plus, FileSpreadsheet, Mail, ShieldCheck, BadgeCheck } from "lucide-react"
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
import { WorkerForm, workerPayload, type WorkerFormValues } from "@/features/workers/components/worker-form"
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
        ...workerPayload(values),
        role: values.role,
        crewId: values.crewId || undefined,
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
      key: "people",
      done: s.hasWorkers,
      icon: Users,
      title: "Get your people in",
      detail: s.hasWorkers
        ? `${s.workerCount} people on the roster`
        : "If you already keep a roster spreadsheet, importing it is by far the fastest way — it brings the people, their groups and the whole year of shifts in one go.",
      action: (
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/settings#import" variant={s.hasWorkers ? "outline" : "default"} size="sm">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Import a spreadsheet
          </LinkButton>
          <LinkButton href="/workers" variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-1" /> Invite people
          </LinkButton>
          <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "worker" })}>
            <Plus className="h-4 w-4 mr-1" /> Add one by hand
          </Button>
        </div>
      ),
    },
    {
      key: "coverage",
      done: s.hasCoverage,
      icon: ShieldCheck,
      title: "Say what each shift needs",
      detail: s.hasCoverage
        ? `${s.coverageRoleCount} jobs and ${s.positionGroupCount} groups set up`
        : "How many outside operators, how many in the control room, days and nights. One button sets up the standard offshore layout.",
      action: (
        <LinkButton href="/settings#coverage" variant={s.hasCoverage ? "outline" : "default"} size="sm">
          {s.hasCoverage ? "Review coverage rules" : "Set up coverage"} <ArrowRight className="h-4 w-4 ml-1" />
        </LinkButton>
      ),
    },
    {
      key: "groups",
      done: s.hasGroupedWorkers,
      icon: Users2,
      title: "Put each person in their group",
      detail: s.hasGroupedWorkers
        ? `${s.groupedWorkerCount} of ${s.workerCount} people are in a group`
        : "So the app knows an Ops Tech marked D is outside, and an OCR Op marked D is in the control room. Importing a spreadsheet does this for you.",
      action: (
        <LinkButton href={s.hasCoverage ? "/workers" : "/settings#coverage"} variant={s.hasGroupedWorkers ? "outline" : "default"} size="sm">
          {s.hasCoverage ? "Open Workers" : "Set up coverage first"} <ArrowRight className="h-4 w-4 ml-1" />
        </LinkButton>
      ),
    },
    {
      key: "signoffs",
      done: s.hasSignOffs,
      icon: BadgeCheck,
      title: "Record who is signed off on what",
      detail: s.hasSignOffs
        ? `${s.signedOffWorkerCount} people have sign-offs recorded`
        : "Utilities, oil, gas, control room. A shift needs a different person for each job it requires, so this is what tells you whether a crew can actually run.",
      action: (
        <div className="flex flex-wrap gap-2">
          <LinkButton href={s.hasCoverage ? "/workers" : "/settings#coverage"} variant={s.hasSignOffs ? "outline" : "default"} size="sm">
            {s.hasCoverage ? "Tick them off" : "Set up coverage first"} <ArrowRight className="h-4 w-4 ml-1" />
          </LinkButton>
          <LinkButton href="/help#sign-off" variant="ghost" size="sm">
            What is a sign-off?
          </LinkButton>
        </div>
      ),
    },
    {
      key: "schedules",
      done: s.hasSchedules,
      icon: Calendar,
      title: "Fill the calendar",
      detail: s.hasSchedules
        ? `${s.scheduleCount.toLocaleString()} shifts on the calendar`
        : crewsWithPattern.length
          ? "Generate each crew's rotation forward from today. Importing a spreadsheet fills it in too."
          : "Either import a spreadsheet, or set up a rotation pattern and crews and let the app generate it.",
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
          {!crewsWithPattern.length && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "crew" })}>
              <Plus className="h-4 w-4 mr-1" /> Add a crew
            </Button>
          )}
          {s.hasSchedules && (
            <LinkButton href="/schedule" variant="ghost" size="sm">
              View schedule <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
          )}
        </div>
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

      {/* The fast path. Someone arriving from a spreadsheet will otherwise
          hand-enter people they could have uploaded in a minute. */}
      {!s.hasSchedules && (
        <Card className="border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5" aria-hidden />
              Already keep the roster in a spreadsheet?
            </CardTitle>
            <CardDescription>
              Then start there. Set up the coverage rules first so your codes have something to map onto, then upload the
              workbook — it brings in the people, their groups, who is signed off on what, and the whole year of shifts.
              You are shown exactly what it found before anything is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <LinkButton href="/settings#coverage" size="sm" variant={s.hasCoverage ? "outline" : "default"}>
              1. Set up coverage <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
            <LinkButton href="/settings#import" size="sm" variant={s.hasCoverage ? "default" : "outline"}>
              2. Import the workbook <ArrowRight className="h-4 w-4 ml-1" />
            </LinkButton>
            <LinkButton href="/help" size="sm" variant="ghost">
              Read the short guide
            </LinkButton>
          </CardContent>
        </Card>
      )}

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

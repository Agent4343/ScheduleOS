"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, ShieldCheck } from "lucide-react"
import { Button, LinkButton } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { errorMessage } from "@/lib/api-client"
import { addDaysKey, formatDateRange, todayKey } from "@/lib/dates"
import { useCoverage } from "@/features/coverage/hooks"
import { CoverageBoard } from "@/features/coverage/components/coverage-board"

const WINDOW_DAYS = 14

/** Coverage: are there enough people in each role on each shift? */
export default function CoveragePage() {
  const [start, setStart] = useState(() => addDaysKey(todayKey(), -1))
  const end = addDaysKey(start, WINDOW_DAYS - 1)
  const coverage = useCoverage(start, end)

  const shortDays = coverage.data?.days.filter((d) => d.status === "red").length ?? 0
  const amberDays = coverage.data?.days.filter((d) => d.status === "amber").length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coverage</h1>
          <p className="text-muted-foreground">Who is on each role, each shift, against the minimums.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStart(addDaysKey(todayKey(), -1))}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Earlier" onClick={() => setStart(addDaysKey(start, -WINDOW_DAYS))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm font-medium" aria-live="polite">{formatDateRange(start, end)}</span>
          <Button variant="outline" size="icon" aria-label="Later" onClick={() => setStart(addDaysKey(start, WINDOW_DAYS))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {coverage.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {errorMessage(coverage.error, "Could not load coverage")}{" "}
            <button className="underline" onClick={() => coverage.refetch()}>Retry</button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            {coverage.data?.configured
              ? shortDays > 0
                ? `${shortDays} day(s) short, ${amberDays} at minimum`
                : amberDays > 0
                  ? `Covered · ${amberDays} day(s) at minimum`
                  : "Fully covered"
              : "Coverage roles not set up"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coverage.isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : coverage.data && !coverage.data.configured ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Define coverage roles (Outside Ops, Control Room, OIM…), assign workers to position groups, and map duty
                codes like OCR-D or PL-N to roles. There is a one-click template for offshore operations.
              </p>
              <LinkButton href="/settings#coverage" size="sm">
                Set up coverage
              </LinkButton>
            </div>
          ) : coverage.data ? (
            <CoverageBoard days={coverage.data.days} roles={coverage.data.roles} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

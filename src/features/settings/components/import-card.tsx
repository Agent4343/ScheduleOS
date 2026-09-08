"use client"

import { useRef, useState } from "react"
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { errorMessage } from "@/lib/api-client"
import { formatDateOnly } from "@/lib/dates"
import { useImportSchedule, type ImportPlan, type ImportResult } from "@/features/import/hooks"
import { SettingsCard } from "./settings-card"

/**
 * Import a roster spreadsheet.
 *
 * Two passes over the same file: the first only describes what the parser
 * found, the second writes it. The layout of these workbooks is a convention,
 * not a format, so a human confirms the reading before anything is saved.
 */
export function ImportCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast()
  const confirm = useConfirm()
  const importer = useImportSchedule()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [done, setDone] = useState<ImportResult | null>(null)
  const [createMissing, setCreateMissing] = useState(true)

  if (!isAdmin) return null

  const reset = () => {
    setFile(null)
    setPlan(null)
    setDone(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  const preview = async (chosen: File, sheet?: string) => {
    setDone(null)
    try {
      const { plan } = await importer.mutateAsync({ file: chosen, sheet })
      setFile(chosen)
      setPlan(plan)
    } catch (error) {
      toast.error(errorMessage(error, "Could not read that file"))
      reset()
    }
  }

  const commit = async () => {
    if (!file || !plan) return

    // The import clears the date range before writing, so anything set by
    // hand in that window goes. The preview says so, but this is the last
    // moment to stop and it is worth one explicit yes.
    const range = plan.dateRange
    const ok = await confirm({
      title: "Import this schedule?",
      description: range
        ? `${plan.shiftCount.toLocaleString()} shifts will be written for ${plan.people.length} people, covering ${formatDateOnly(range.start, "long")} to ${formatDateOnly(range.end, "long")}. Existing shifts in that range for these people are replaced — including any you set by hand. Days outside the range are untouched.`
        : `${plan.shiftCount.toLocaleString()} shifts will be written.`,
      confirmLabel: "Import",
    })
    if (!ok) return

    try {
      const { imported } = await importer.mutateAsync({
        file,
        sheet: plan.sheetName,
        commit: true,
        createMissingPeople: createMissing,
        replaceRange: true,
      })
      setDone(imported)
      toast.success("Schedule imported")
    } catch (error) {
      toast.error(errorMessage(error, "The import failed"))
    }
  }

  const unmatched = plan?.people.filter((p) => !p.matchedId) ?? []
  const newCodes = plan?.codes.filter((c) => !c.known) ?? []

  return (
    <div id="import" className="md:col-span-2 scroll-mt-20">
      <SettingsCard
        icon={FileSpreadsheet}
        title="Import from a spreadsheet"
        description="Load an operations roster workbook: people, groups, sign-offs and a year of shifts"
      >
        {!plan && !done && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="import-file">Workbook (.xlsx or .xlsm)</Label>
              <input
                ref={inputRef}
                id="import-file"
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) preview(f)
                }}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">No spreadsheet yet?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Download a blank one, set up with your position groups and duty codes. Describe your rotations on its
                first tab, then give each person a rotation, a start date and whether they start on days or nights — it
                works out the rest of the year for you.
              </p>
              <a
                href="/api/import/template"
                className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4"
                download
              >
                <Download className="h-4 w-4" aria-hidden />
                Download a blank roster template
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              Nothing is saved until you have seen what was found and confirmed it.
            </p>
            {importer.isPending && <p className="text-sm text-muted-foreground">Reading the workbook…</p>}
          </div>
        )}

        {plan && !done && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{file?.name}</span>
              <span className="text-muted-foreground">· sheet</span>
              {plan.availableSheets.length > 1 ? (
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={plan.sheetName}
                  onChange={(e) => file && preview(file, e.target.value)}
                  aria-label="Sheet to import"
                >
                  {plan.availableSheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium">{plan.sheetName}</span>
              )}
            </div>

            {plan.warnings.length > 0 && (
              <Alert>
                <AlertDescription>
                  <span className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" aria-hidden /> Worth checking
                  </span>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["People", String(plan.people.length)],
                ["Groups", String(plan.groups.length)],
                ["Shifts", plan.shiftCount.toLocaleString()],
                ["Dates", plan.dateRange ? `${plan.dateRange.days} days` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {plan.dateRange && (
              <p className="text-sm text-muted-foreground">
                Covers {formatDateOnly(plan.dateRange.start, "long")} to {formatDateOnly(plan.dateRange.end, "long")}.
                Existing shifts in that range, for these people, are replaced.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <h4 className="text-sm font-medium">Position groups</h4>
                <ul className="mt-1 space-y-1 text-sm">
                  {plan.groups.map((g) => (
                    <li key={g.name} className="flex justify-between gap-2">
                      <span>{g.name} <span className="text-xs text-muted-foreground">{g.members} people</span></span>
                      <span className="text-xs text-muted-foreground">{g.existing ? "existing" : "new"}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-sm font-medium">Shift codes</h4>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {plan.codes.map((c) => (
                    <li
                      key={c.code}
                      className={`rounded border px-1.5 py-0.5 text-xs ${c.known ? "" : "border-amber-400 text-amber-700 dark:text-amber-300"}`}
                      title={c.known ? `${c.count} uses` : `${c.count} uses — will be created`}
                    >
                      {c.code} <span className="opacity-60">{c.count}</span>
                    </li>
                  ))}
                </ul>
                {newCodes.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {newCodes.length} new code{newCodes.length === 1 ? "" : "s"} will be created. Set what each one counts
                    toward afterwards, under Coverage.
                  </p>
                )}
              </section>
            </div>

            <section>
              <h4 className="text-sm font-medium">
                People <span className="font-normal text-muted-foreground">({plan.people.length - unmatched.length} matched, {unmatched.length} not in the app)</span>
              </h4>
              <ul className="mt-1 max-h-52 overflow-y-auto rounded-md border divide-y text-sm">
                {plan.people.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 px-2 py-1">
                    <span className="truncate">
                      {p.name}
                      {p.qualifications.map((q) => (
                        <span key={q} className="ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px]">{q}</span>
                      ))}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.group ?? "no group"} · {p.shifts} shifts · {p.matchedId ? "matched" : "new"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {unmatched.length > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
                <span>
                  Create the {unmatched.length} people who are not in the app yet.
                  <span className="block text-xs text-muted-foreground">
                    They get a placeholder email address and no password, so they appear on the roster but cannot sign in
                    until you give them a real address. Unticked, their shifts are skipped.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={commit} disabled={importer.isPending}>
                <Upload className="h-4 w-4 mr-1" />
                {importer.isPending ? "Importing…" : "Import"}
              </Button>
              <Button variant="outline" onClick={reset} disabled={importer.isPending}>Cancel</Button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <p className="font-medium">Import complete.</p>
            <ul className="list-disc pl-5 text-sm">
              <li>{done.shiftsWritten.toLocaleString()} shifts written{done.shiftsReplaced > 0 && `, replacing ${done.shiftsReplaced.toLocaleString()}`}</li>
              <li>{done.peopleUpdated} people updated{done.peopleCreated > 0 && `, ${done.peopleCreated} created`}</li>
              {done.groupsCreated > 0 && <li>{done.groupsCreated} position groups created</li>}
              {done.codesCreated > 0 && <li>{done.codesCreated} shift codes created — set their coverage roles under Coverage</li>}
              {done.skipped.length > 0 && <li>Skipped (not in the app): {done.skipped.join(", ")}</li>}
            </ul>
            <Button variant="outline" onClick={reset}>Import another</Button>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}

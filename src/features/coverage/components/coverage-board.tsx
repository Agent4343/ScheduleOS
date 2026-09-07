"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { formatDateOnly, parseDateOnly } from "@/lib/dates"
import type { CoverageRole, CoverageStatus, DayCoverage, RoleShiftCoverage } from "../hooks"

const STATUS_CLASS: Record<CoverageStatus, string> = {
  ok: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  red: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100 font-semibold",
}

const STATUS_LABEL: Record<CoverageStatus, string> = { ok: "Covered", amber: "At minimum", red: "Short" }

interface CoverageBoardProps {
  days: DayCoverage[]
  roles: CoverageRole[]
}

/**
 * The coverage sheet: one column per day, one row per (role, shift), each
 * cell "have / min" coloured like the workbook (red below min, amber at or
 * below target). Click a cell to see who is on.
 */
export function CoverageBoard({ days, roles }: CoverageBoardProps) {
  const [open, setOpen] = useState<{ date: string; line: RoleShiftCoverage } | null>(null)

  // Row order: role sortOrder, DAY before NIGHT; only lines that appear somewhere
  const rowKeys = new Map<string, { roleName: string; shift: "DAY" | "NIGHT"; order: number }>()
  for (const d of days) {
    for (const l of d.lines) {
      const key = `${l.roleId}|${l.shift}`
      if (!rowKeys.has(key)) {
        const role = roles.find((r) => r.id === l.roleId)
        rowKeys.set(key, { roleName: l.roleName, shift: l.shift, order: (role?.sortOrder ?? 99) * 2 + (l.shift === "NIGHT" ? 1 : 0) })
      }
    }
  }
  const rows = Array.from(rowKeys.entries()).sort((a, b) => a[1].order - b[1].order)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No coverage roles are configured yet.</p>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm" style={{ minWidth: "max-content" }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-background border p-2 text-left min-w-[190px]">
                Coverage line
              </th>
              {days.map((d) => {
                const dt = parseDateOnly(d.date)
                const weekend = dt.getDay() === 0 || dt.getDay() === 6
                return (
                  <th
                    key={d.date}
                    scope="col"
                    className={cn("border p-1 text-center font-normal min-w-[44px]", weekend && "bg-muted/60")}
                    title={formatDateOnly(d.date, "long")}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground">{dt.toLocaleDateString(undefined, { weekday: "short" })}</div>
                    <div className="font-semibold">{dt.getDate()}</div>
                    <div className={cn("mx-auto mt-0.5 h-1 w-6 rounded-full", d.status === "red" ? "bg-red-500" : d.status === "amber" ? "bg-amber-500" : "bg-green-500")} aria-label={STATUS_LABEL[d.status]} />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, meta]) => (
              <tr key={key}>
                <th scope="row" className="sticky left-0 z-10 bg-background border p-2 text-left font-medium">
                  {meta.roleName}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{meta.shift === "DAY" ? "days" : "nights"}</span>
                </th>
                {days.map((d) => {
                  const line = d.lines.find((l) => `${l.roleId}|${l.shift}` === key)
                  if (!line) return <td key={d.date} className="border" />
                  const isOpen = open?.date === d.date && open.line === line
                  return (
                    <td key={d.date} className="border p-0">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : { date: d.date, line })}
                        className={cn(
                          "w-full h-9 px-1 text-center tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          STATUS_CLASS[line.status],
                          isOpen && "ring-2 ring-inset ring-blue-500"
                        )}
                        title={
                          line.signOffShortfall
                            ? `Sign-off missing: ${line.signOffs.filter((s) => s.filled < s.need).map((s) => s.name).join(", ")}`
                            : `${STATUS_LABEL[line.status]}: ${line.have} of ${line.min} minimum (target ${line.target})`
                        }
                        aria-expanded={isOpen}
                      >
                        {line.have}
                        <span className="opacity-60">/{line.min}</span>
                        {line.signOffShortfall && (
                          <span className="ml-0.5 font-bold" aria-label="sign-off missing">!</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Cells show <strong>have / minimum</strong>.</span>
        <span className={cn("rounded px-2 py-0.5", STATUS_CLASS.ok)}>Covered</span>
        <span className={cn("rounded px-2 py-0.5", STATUS_CLASS.amber)}>At minimum (below target)</span>
        <span className={cn("rounded px-2 py-0.5", STATUS_CLASS.red)}>Short</span>
        <span><strong>!</strong> a required sign-off cannot be filled</span>
      </div>

      {open && (
        <div className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {open.line.roleName} · {open.line.shift === "DAY" ? "days" : "nights"} · {formatDateOnly(open.date, "weekday")}
            </p>
            <p className="text-muted-foreground">
              {open.line.have} on shift · minimum {open.line.min} · target {open.line.target}
            </p>
          </div>
          {open.line.signOffs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {open.line.signOffs.map((s) => (
                <li key={s.code} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className={cn("font-medium", s.filled < s.need && "text-red-700 dark:text-red-300")}>
                    {s.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.filled} of {s.need}
                  </span>
                  {s.by.length > 0 && <span className="text-muted-foreground">— {s.by.map((b) => b.name).join(", ")}</span>}
                  {s.filled < s.need && <span className="text-red-700 dark:text-red-300">nobody left to cover this</span>}
                </li>
              ))}
            </ul>
          )}

          {open.line.roster.length === 0 ? (
            <p className="mt-2 text-muted-foreground">Nobody is scheduled for this line.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {open.line.roster.map((r) => (
                <li
                  key={r.userId}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5",
                    r.unqualified && "border-red-400 text-red-700 dark:text-red-300 line-through"
                  )}
                  title={r.unqualified ? "Lacks the qualification this role requires; not counted" : r.via}
                >
                  {r.name}
                  {r.via !== "DAY" && r.via !== "NIGHT" && <span className="ml-1 text-xs text-muted-foreground">{r.via}</span>}
                  {r.isBackfill && <span className="ml-1 text-xs text-muted-foreground">(backfill)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

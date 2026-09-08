"use client"

import Link from "next/link"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiGet } from "@/lib/api-client"
import { formatDateOnly } from "@/lib/dates"

interface Gap {
  date: string
  problems: {
    role: string
    shift: "DAY" | "NIGHT"
    have: number
    min: number
    missingSignOffs: { name: string; short: number }[]
  }[]
}

interface GapsResult {
  configured: boolean
  days: number
  gaps: Gap[]
  standInDays: number
}

/**
 * Days ahead that cannot be staffed. Sits on the dashboard because a gap you
 * have to go looking for is a gap that gets found the morning it happens.
 */
export function CoverageAlert({ days = 21 }: { days?: number }) {
  const query = useQuery({
    queryKey: ["coverage-gaps", days],
    queryFn: () => apiGet<GapsResult>(`/api/coverage/gaps?days=${days}`),
    // Not worth a spinner or an error state on the dashboard
    retry: false,
  })

  const data = query.data
  if (!data || !data.configured) return null

  if (data.gaps.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4 text-sm">
          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-500" aria-hidden />
          <span>
            Every shift for the next {data.days} days can be staffed.
            {data.standInDays > 0 && (
              <span className="text-muted-foreground">
                {" "}
                {data.standInDays} {data.standInDays === 1 ? "day relies" : "days rely"} on a stand-in.
              </span>
            )}
          </span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-red-300 dark:border-red-900">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-300">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          {data.gaps.length} {data.gaps.length === 1 ? "day" : "days"} in the next {data.days} cannot be staffed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="divide-y text-sm">
          {data.gaps.slice(0, 8).map((gap) => (
            <li key={gap.date} className="py-1.5">
              <p className="font-medium">{formatDateOnly(gap.date, "weekday")}</p>
              <ul className="text-muted-foreground">
                {gap.problems.map((p, i) => (
                  <li key={i}>
                    {p.role} · {p.shift === "DAY" ? "days" : "nights"} —{" "}
                    {p.missingSignOffs.length > 0
                      ? `no ${p.missingSignOffs.map((s) => s.name).join(", no ")}`
                      : `${p.have} of ${p.min}`}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {data.gaps.length > 8 && (
          <p className="text-xs text-muted-foreground">and {data.gaps.length - 8} more</p>
        )}
        <Link href="/coverage" className="inline-block text-sm underline underline-offset-4">
          Open the coverage board
        </Link>
      </CardContent>
    </Card>
  )
}

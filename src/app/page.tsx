import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Footer } from "@/components/layout/footer"
import {
  Calendar,
  Users,
  Clock,
  Shield,
  BarChart3,
  Bell,
  CheckCircle2,
  ArrowRight,
  Zap,
  Repeat,
  QrCode,
  Bot,
  FileSpreadsheet,
  AlertTriangle,
  X,
  ChevronRight,
  Star,
  ArrowLeftRight,
  ClipboardCheck,
  Layers,
  MousePointerClick,
} from "lucide-react"

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ShiftSync</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="sm:size-default">Sign In</Button>
            </Link>
            <Link href="/pricing">
              <Button size="sm" className="sm:size-default">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-28 bg-gradient-to-b from-background via-background to-muted/30 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
                  <Zap className="h-3.5 w-3.5" />
                  AI-powered scheduling platform
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
                  Stop wrestling with
                  <br />
                  <span className="text-primary">shift schedules</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                  ShiftSync auto-generates crew rotations, handles time-off requests, tracks attendance, and keeps your entire workforce in sync. One platform for everything shift-based.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Link href="/pricing">
                    <Button size="lg" className="gap-2 text-base px-8 h-12">
                      Start Free 14-Day Trial
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#features">
                    <Button size="lg" variant="outline" className="text-base px-8 h-12">
                      See It In Action
                    </Button>
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground">
                  No credit card required &middot; Set up in under 5 minutes
                </p>
              </div>

              {/* Hero Dashboard Preview */}
              <div className="relative lg:ml-8 mt-8 lg:mt-0">
                <div className="bg-background rounded-xl shadow-2xl border overflow-hidden">
                  {/* Browser chrome */}
                  <div className="bg-muted/60 px-4 py-2.5 border-b flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-xs text-muted-foreground bg-background rounded px-3 py-0.5">
                        app.shiftsync.com/dashboard
                      </span>
                    </div>
                  </div>
                  {/* Dashboard content */}
                  <div className="p-5">
                    {/* Metric cards */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "On Duty", value: "24", sub: "12 day / 12 night", color: "text-green-600" },
                        { label: "On Site", value: "22", sub: "2 pending check-in", color: "text-blue-600" },
                        { label: "Workers", value: "48", sub: "4 crews active", color: "text-foreground" },
                        { label: "Requests", value: "3", sub: "2 time-off, 1 swap", color: "text-amber-600" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-lg border bg-card p-3">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{m.label}</p>
                          <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                        </div>
                      ))}
                    </div>
                    {/* Mini schedule grid */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-semibold">This Week&apos;s Schedule</span>
                        <span className="text-[10px] text-muted-foreground">Feb 17 - 23, 2026</span>
                      </div>
                      <div className="grid grid-cols-8 text-[10px]">
                        <div className="p-2 border-r border-b font-medium bg-muted/20">Crew</div>
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                          <div key={d} className="p-2 border-r border-b last:border-r-0 text-center font-medium bg-muted/20">{d}</div>
                        ))}
                        {[
                          { name: "Alpha", color: "bg-blue-500", shifts: ["D","D","D","N","N","N","—"] },
                          { name: "Bravo", color: "bg-emerald-500", shifts: ["N","N","—","—","D","D","D"] },
                          { name: "Charlie", color: "bg-amber-500", shifts: ["—","—","D","D","D","N","N"] },
                          { name: "Delta", color: "bg-purple-500", shifts: ["D","N","N","—","—","D","D"] },
                        ].map((crew) => (
                          <div key={crew.name} className="contents">
                            <div className="p-2 border-r border-b flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${crew.color}`} />
                              <span className="font-medium">{crew.name}</span>
                            </div>
                            {crew.shifts.map((s, i) => (
                              <div key={i} className="p-1 border-r border-b last:border-r-0">
                                <div className={`rounded text-[9px] font-semibold flex items-center justify-center h-6 ${
                                  s === "D" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                  : s === "N" ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
                                  : "bg-muted text-muted-foreground"
                                }`}>
                                  {s === "D" ? "DAY" : s === "N" ? "NGT" : "OFF"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating notification card */}
                <div className="hidden sm:block absolute -bottom-4 -left-4 bg-background rounded-lg shadow-lg border p-3 max-w-[220px]">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Time-off approved</p>
                      <p className="text-[10px] text-muted-foreground">Sarah M. &mdash; Feb 24-28</p>
                    </div>
                  </div>
                </div>
                {/* Floating AI card */}
                <div className="hidden sm:block absolute -top-3 -right-3 bg-background rounded-lg shadow-lg border p-3 max-w-[200px]">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">AI Assistant</p>
                      <p className="text-[10px] text-muted-foreground">&ldquo;All crews are covered this week&rdquo;</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points — What you're replacing */}
        <section className="py-16 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Sound familiar?</h2>
              <p className="text-muted-foreground">The problems every shift-based operation deals with.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "Spreadsheet chaos",
                  desc: "Schedules live in fragile Excel files that break when someone edits the wrong cell",
                },
                {
                  icon: AlertTriangle,
                  title: "Staffing gaps",
                  desc: "You find out a shift is short-staffed when it's already too late to fix it",
                },
                {
                  icon: Clock,
                  title: "Manual time tracking",
                  desc: "Check-ins on paper or WhatsApp messages that nobody can audit later",
                },
                {
                  icon: X,
                  title: "Request bottlenecks",
                  desc: "Time-off and swap requests sit in an inbox until someone remembers to approve them",
                },
              ].map((pain) => (
                <div key={pain.title} className="flex gap-3 p-5 rounded-xl bg-background border">
                  <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0">
                    <pain.icon className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{pain.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{pain.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <p className="text-sm text-muted-foreground">
                ShiftSync replaces all of this with <span className="font-semibold text-foreground">one platform</span>.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Deep Dive #1 — Schedule Generation */}
        <section id="features" className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 mb-4">
                  <Repeat className="h-3 w-3" />
                  Rotation Engine
                </div>
                <h2 className="text-3xl font-bold mb-4">Auto-generate full-year schedules in one click</h2>
                <p className="text-muted-foreground mb-6">
                  Define your rotation pattern once — 14/14, 21/21, 4-on/4-off, or anything custom — and ShiftSync generates
                  the entire year for every crew. Day shifts, night shifts, alternating patterns, all handled.
                </p>
                <ul className="space-y-3">
                  {[
                    "Any rotation pattern: days on, days off, night shifts included",
                    "Multi-crew synchronization with phase tracking",
                    "Manual override any day — the system tracks your changes",
                    "Custom shift types with your own color codes",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Schedule mockup */}
              <div className="bg-background rounded-xl shadow-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Schedule — February 2026</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-7 px-3 rounded bg-muted text-xs flex items-center font-medium">Filter by Crew</div>
                    <div className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs flex items-center font-medium">Generate</div>
                  </div>
                </div>
                <div className="p-4 overflow-x-auto">
                  <div className="min-w-[500px]">
                    {/* Header row */}
                    <div className="grid grid-cols-[100px_repeat(14,1fr)] gap-0.5 mb-0.5">
                      <div className="text-[10px] font-semibold p-1.5 text-muted-foreground">Worker</div>
                      {Array.from({ length: 14 }, (_, i) => (
                        <div key={i} className="text-[9px] p-1 text-center text-muted-foreground font-medium">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    {/* Worker rows */}
                    {[
                      { name: "J. Martinez", crew: "bg-blue-500", pattern: "DDDDDDDNNNNNN—" },
                      { name: "R. Campbell", crew: "bg-blue-500", pattern: "DDDDDNNNNNN——D" },
                      { name: "T. Wilson", crew: "bg-emerald-500", pattern: "NNNNN——DDDDDDD" },
                      { name: "M. Ahmed", crew: "bg-emerald-500", pattern: "NNNN——DDDDDDDN" },
                      { name: "S. O'Brien", crew: "bg-amber-500", pattern: "——DDDDDDDNNNNN" },
                      { name: "K. Patel", crew: "bg-amber-500", pattern: "—DDDDDDDNNNNNN" },
                    ].map((w) => (
                      <div key={w.name} className="grid grid-cols-[100px_repeat(14,1fr)] gap-0.5 mb-0.5">
                        <div className="text-[10px] p-1.5 flex items-center gap-1.5 font-medium">
                          <div className={`w-1.5 h-1.5 rounded-full ${w.crew}`} />
                          {w.name}
                        </div>
                        {w.pattern.split("").map((s, i) => (
                          <div key={i} className={`rounded text-[8px] font-bold flex items-center justify-center h-6 ${
                            s === "D" ? "bg-blue-500 text-white"
                            : s === "N" ? "bg-indigo-600 text-white"
                            : "bg-muted text-muted-foreground"
                          }`}>
                            {s === "D" ? "D" : s === "N" ? "N" : "—"}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> Day</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-600" /> Night</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-muted border" /> Off</span>
                  <span className="ml-auto">Showing 6 of 48 workers</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Deep Dive #2 — Time-Off, Swaps, Attendance */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Feature cards stack */}
              <div className="order-2 lg:order-1 space-y-4">
                {/* Time-off card */}
                <div className="bg-background rounded-xl border shadow-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <span className="text-sm font-semibold">Time-Off Requests</span>
                    </div>
                    <span className="text-xs bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">3 pending</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { name: "Sarah M.", type: "Vacation", dates: "Feb 24-28", status: "pending" },
                      { name: "James K.", type: "Sick Leave", dates: "Feb 20", status: "approved" },
                      { name: "Priya D.", type: "Personal", dates: "Mar 3-4", status: "pending" },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {r.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{r.name} &middot; {r.type}</p>
                            <p className="text-[10px] text-muted-foreground">{r.dates}</p>
                          </div>
                        </div>
                        {r.status === "approved" ? (
                          <span className="text-[10px] bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Approved</span>
                        ) : (
                          <div className="flex gap-1">
                            <div className="w-6 h-6 rounded bg-green-500 flex items-center justify-center cursor-pointer">
                              <CheckCircle2 className="h-3 w-3 text-white" />
                            </div>
                            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center cursor-pointer">
                              <X className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shift swap card */}
                <div className="bg-background rounded-xl border shadow-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/15 flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold">Shift Swap</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="text-center">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 mx-auto">TW</div>
                      <p className="text-[10px] mt-1 font-medium">T. Wilson</p>
                      <p className="text-[9px] text-muted-foreground">Night &rarr; Day</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mx-auto">RC</div>
                      <p className="text-[10px] mt-1 font-medium">R. Campbell</p>
                      <p className="text-[9px] text-muted-foreground">Day &rarr; Night</p>
                    </div>
                    <div className="ml-2">
                      <div className="h-7 px-3 rounded bg-primary text-primary-foreground text-[10px] flex items-center font-medium">Approve</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 mb-4">
                  <ArrowLeftRight className="h-3 w-3" />
                  Workflow Automation
                </div>
                <h2 className="text-3xl font-bold mb-4">Time-off, shift swaps, and approvals on autopilot</h2>
                <p className="text-muted-foreground mb-6">
                  Workers request time off or swap shifts from their own account. Supervisors approve with one tap.
                  The schedule updates instantly. No back-and-forth emails, no spreadsheet edits, no mistakes.
                </p>
                <ul className="space-y-3">
                  {[
                    "Vacation, sick leave, personal, bereavement, and custom types",
                    "Multi-step swap workflow: request → accept → approve",
                    "Automatic conflict detection against staffing rules",
                    "Full audit trail of every request and decision",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Deep Dive #3 — AI Assistant + Attendance */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 mb-4">
                  <Bot className="h-3 w-3" />
                  AI Assistant
                </div>
                <h2 className="text-3xl font-bold mb-4">Ask your schedule anything, in plain English</h2>
                <p className="text-muted-foreground mb-6">
                  The built-in AI assistant understands your workforce data. Ask about coverage gaps, make changes to shifts,
                  check who&apos;s available, or generate reports — all through natural conversation.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    "\"Who's working night shift this Friday?\"",
                    "\"Move Sarah to day shift next week\"",
                    "\"Show me pending time-off requests\"",
                    "\"Do we have enough operators for March?\"",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <ChevronRight className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                      <span className="text-sm italic text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* AI Chat mockup */}
              <div className="bg-background rounded-xl shadow-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 border-b flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">AI Assistant</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Beta</span>
                </div>
                <div className="p-4 space-y-4 min-h-[300px]">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                      <p className="text-sm">Who&apos;s on night shift this week and do we have enough coverage?</p>
                    </div>
                  </div>
                  {/* AI response */}
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                      <p className="text-sm mb-2">Here&apos;s your night shift coverage for this week:</p>
                      <div className="bg-background rounded-lg p-2.5 text-xs space-y-1.5 mb-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Alpha crew:</span><span className="font-medium">6 workers</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Bravo crew:</span><span className="font-medium">5 workers</span></div>
                        <div className="flex justify-between border-t pt-1.5 mt-1.5"><span className="font-medium">Total on nights:</span><span className="font-bold text-green-600">11 workers</span></div>
                      </div>
                      <p className="text-sm">You&apos;re at <span className="font-semibold text-green-600">110% of minimum</span> staffing. All positions are covered. No gaps this week.</p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t flex items-center gap-2">
                  <div className="flex-1 h-9 rounded-lg bg-muted px-3 flex items-center text-xs text-muted-foreground">
                    Ask about schedules, workers, or reports...
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid — Everything Else */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Everything you need. Nothing you don&apos;t.</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Every feature is built for shift-based operations. No bloat, no features you&apos;ll never use.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {[
                {
                  icon: QrCode,
                  title: "QR Code Attendance",
                  desc: "Workers check in by scanning a personal QR code. Supervisors scan to verify. Full audit trail with timestamps.",
                  color: "bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400",
                },
                {
                  icon: Shield,
                  title: "Staffing Rules Engine",
                  desc: "Set minimum crew sizes, position requirements, and max vacation limits. Get alerted before gaps happen.",
                  color: "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400",
                },
                {
                  icon: BarChart3,
                  title: "Reports & Analytics",
                  desc: "Shift distribution, work utilization, overtime trends, and crew breakdowns. Export to CSV anytime.",
                  color: "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                },
                {
                  icon: Bell,
                  title: "Announcements",
                  desc: "Post priority-tagged announcements to your entire team. Pin important messages. Set expiration dates.",
                  color: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
                },
                {
                  icon: ClipboardCheck,
                  title: "Audit Log",
                  desc: "Every action is logged — schedule changes, approvals, role changes, and more. Filter by action type.",
                  color: "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
                },
                {
                  icon: Layers,
                  title: "Role-Based Access",
                  desc: "Admins, supervisors, and workers each see exactly what they need. Secure, simple, no confusion.",
                  color: "bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400",
                },
                {
                  icon: Calendar,
                  title: "Calendar Export",
                  desc: "Workers export their personal schedule to iCal and sync with Google Calendar, Outlook, or Apple Calendar.",
                  color: "bg-cyan-100 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
                },
                {
                  icon: Users,
                  title: "Crew Management",
                  desc: "Color-coded crews, rotation phase tracking, and at-a-glance headcounts. Bulk import workers via CSV.",
                  color: "bg-pink-100 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400",
                },
                {
                  icon: MousePointerClick,
                  title: "Custom Shift Types",
                  desc: "Training, shutdown, paid leave, or any type you need. Define your own shift codes and colors.",
                  color: "bg-teal-100 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400",
                },
              ].map((f) => (
                <div key={f.title} className="p-5 rounded-xl bg-background border hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-lg ${f.color} flex items-center justify-center mb-3`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-bold mb-4">Up and running in 5 minutes</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                No consultants. No week-long onboarding. No training sessions.
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { step: "1", title: "Create your org", desc: "Sign up, name your organization, and invite your team." },
                { step: "2", title: "Add crews & workers", desc: "Set up your crews, add workers, and assign rotation patterns." },
                { step: "3", title: "Generate schedules", desc: "One click to generate the full year. Adjust as needed." },
                { step: "4", title: "Go live", desc: "Workers see their schedules, request time off, and check in." },
              ].map((s, i) => (
                <div key={s.step} className="relative text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
                    {s.step}
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-6 left-[calc(50%+32px)] w-[calc(100%-64px)] border-t-2 border-dashed border-primary/30" />
                  )}
                  <h3 className="font-semibold mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials / Social Proof */}
        <section className="py-20 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Trusted by operations teams worldwide</h2>
              <p className="text-muted-foreground">See why teams are switching from spreadsheets to ShiftSync.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
              {[
                {
                  quote: "We went from 4 hours of schedule planning every week to about 10 minutes. The rotation engine just works.",
                  name: "Mike Patterson",
                  role: "Operations Manager",
                  company: "Pacific Energy Corp",
                },
                {
                  quote: "The shift swap feature alone saved us. Workers handle it themselves now instead of calling the office at 6am.",
                  name: "Lisa Chen",
                  role: "HR Director",
                  company: "Northfield Mining",
                },
                {
                  quote: "We finally have visibility into who's actually on site. QR check-in with the audit log was exactly what we needed for compliance.",
                  name: "David Okafor",
                  role: "Site Supervisor",
                  company: "Gulf Coast Fabrication",
                },
              ].map((t) => (
                <Card key={t.name} className="border bg-background">
                  <CardContent className="pt-6">
                    <div className="flex gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm mb-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}, {t.company}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {[
                { value: "500+", label: "Operations teams" },
                { value: "12,000+", label: "Workers managed" },
                { value: "99.9%", label: "Uptime" },
                { value: "4.8/5", label: "Average rating" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Simple pricing. No surprises.</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Every plan includes a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Starter */}
              <div className="rounded-2xl border bg-background p-6 flex flex-col">
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">Starter</h3>
                  <p className="text-sm text-muted-foreground mt-1">For small teams getting organized</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$49</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {[
                    "Up to 25 workers",
                    "4 crews",
                    "Basic rotation patterns",
                    "Time-off management",
                    "QR attendance",
                    "Email support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register?plan=starter" className="block mt-6">
                  <Button className="w-full" variant="outline" size="lg">Start Free Trial</Button>
                </Link>
              </div>

              {/* Professional */}
              <div className="rounded-2xl border-2 border-primary bg-background p-6 flex flex-col relative">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">Professional</h3>
                  <p className="text-sm text-muted-foreground mt-1">For growing operations</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">$149</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {[
                    "Up to 100 workers",
                    "Unlimited crews",
                    "Custom rotation patterns",
                    "AI scheduling assistant",
                    "Advanced reporting & CSV export",
                    "Staffing rules engine",
                    "Audit log",
                    "Priority support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register?plan=professional" className="block mt-6">
                  <Button className="w-full" size="lg">Start Free Trial</Button>
                </Link>
              </div>

              {/* Enterprise */}
              <div className="rounded-2xl border bg-background p-6 flex flex-col">
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">Enterprise</h3>
                  <p className="text-sm text-muted-foreground mt-1">For large-scale operations</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">Custom</span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {[
                    "Unlimited workers",
                    "Everything in Professional",
                    "API access",
                    "Custom integrations",
                    "SSO / SAML",
                    "Dedicated account manager",
                    "SLA guarantee",
                    "On-prem deployment option",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className="block mt-6">
                  <Button className="w-full" variant="outline" size="lg">Contact Sales</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-24 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your crew deserves better than a spreadsheet
            </h2>
            <p className="max-w-2xl mx-auto mb-8 text-primary-foreground/80 text-lg">
              Join 500+ operations teams who schedule smarter with ShiftSync.
              Start your free trial today — no credit card, no setup fees, no commitment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/pricing">
                <Button size="lg" variant="secondary" className="gap-2 text-base px-8 h-12">
                  Start Your Free 14-Day Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="text-base px-8 h-12 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

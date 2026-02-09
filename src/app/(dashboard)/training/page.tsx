"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import {
  GraduationCap,
  Users,
  Users2,
  Calendar,
  Wand2,
  CalendarOff,
  BarChart3,
  Settings,
  Bot,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Play,
  Clock,
  Shield,
  Download,
  Bell,
  Lightbulb,
  Target,
  BookOpen,
} from "lucide-react"

// ─── Training Module Data ────────────────────────────────────────────

interface TrainingStep {
  title: string
  description: string
  tip?: string
}

interface TrainingModule {
  id: string
  title: string
  description: string
  icon: React.ElementType
  duration: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  href: string
  steps: TrainingStep[]
  demoData?: {
    type: "schedule" | "table" | "cards"
    content: React.ReactNode
  }
}

const trainingModules: TrainingModule[] = [
  {
    id: "overview",
    title: "Platform Overview",
    description: "Understand the ShiftSync dashboard and navigation",
    icon: BookOpen,
    duration: "3 min",
    difficulty: "Beginner",
    href: "/dashboard",
    steps: [
      {
        title: "Navigate the Dashboard",
        description: "The Dashboard is your home base. It shows staffing alerts, upcoming time-off, and key workforce metrics at a glance.",
        tip: "Look for the red alert badges — they indicate staffing shortages that need immediate attention.",
      },
      {
        title: "Use the Sidebar Navigation",
        description: "The sidebar (desktop) or bottom tabs (mobile) let you access all major sections: Setup, Schedule, Workers, Crews, Time Off, Reports, and Settings.",
        tip: "On mobile, swipe left on the sidebar to close it, or use the bottom tab bar for quick access.",
      },
      {
        title: "Check Notifications",
        description: "Click the bell icon in the header to see recent notifications about schedule changes, time-off requests, and staffing alerts.",
      },
    ],
  },
  {
    id: "workers",
    title: "Managing Workers",
    description: "Add, edit, and organize your workforce",
    icon: Users,
    duration: "5 min",
    difficulty: "Beginner",
    href: "/workers",
    steps: [
      {
        title: "Invite Workers",
        description: "Click 'Invite Worker' to send email invitations. Workers receive a link to create their account and join your organization.",
        tip: "You can also add workers directly if you don't need them to have login access.",
      },
      {
        title: "Set Roles and Positions",
        description: "Assign each worker a system role (Admin, Supervisor, Worker) and a position. Custom roles can be created in Settings for finer access control.",
      },
      {
        title: "Track Certifications",
        description: "Add training certifications to each worker's profile. ShiftSync will warn you when a shift lacks required certified personnel.",
        tip: "Set expiry dates on certifications to get automatic renewal reminders.",
      },
      {
        title: "Assign to Crews",
        description: "Every worker should belong to a crew. Crews determine which rotation pattern a worker follows.",
      },
    ],
    demoData: {
      type: "table",
      content: (
        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="grid grid-cols-3 sm:grid-cols-4 bg-muted/50 p-2 sm:p-3 font-medium">
            <div>Worker</div>
            <div>Crew</div>
            <div className="hidden sm:block">Position</div>
            <div>Status</div>
          </div>
          {[
            { name: "John Smith", crew: "Alpha", crewColor: "#22c55e", position: "Operator", status: "Active" },
            { name: "Sarah Jones", crew: "Bravo", crewColor: "#3b82f6", position: "Supervisor", status: "Active" },
            { name: "Mike Chen", crew: "Alpha", crewColor: "#22c55e", position: "Technician", status: "On Leave" },
          ].map((w) => (
            <div key={w.name} className="grid grid-cols-3 sm:grid-cols-4 p-2 sm:p-3 border-t items-center">
              <div className="font-medium truncate">{w.name}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: w.crewColor }} />
                <span className="truncate">{w.crew}</span>
              </div>
              <div className="hidden sm:block text-muted-foreground">{w.position}</div>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  w.status === "Active" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                }`}>
                  {w.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  },
  {
    id: "crews",
    title: "Creating Crews",
    description: "Group workers into rotating teams",
    icon: Users2,
    duration: "3 min",
    difficulty: "Beginner",
    href: "/crews",
    steps: [
      {
        title: "Create a Crew",
        description: "Click 'Create Crew' and give it a name (e.g., Alpha, Bravo) and a color. Colors make crews easy to distinguish on the schedule.",
      },
      {
        title: "Assign a Rotation Pattern",
        description: "Each crew follows a rotation pattern (e.g., 14 days on / 14 days off). Assign the pattern that matches how this team works.",
        tip: "If your crews follow different schedules, create a separate rotation pattern for each one in Settings first.",
      },
      {
        title: "Add Workers to the Crew",
        description: "From the Workers page, assign each person to their crew. Workers can also be reassigned between crews as needed.",
      },
    ],
    demoData: {
      type: "cards",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: "Alpha Crew", color: "#22c55e", workers: 8, pattern: "14/14" },
            { name: "Bravo Crew", color: "#3b82f6", workers: 7, pattern: "14/14" },
            { name: "Charlie Crew", color: "#f59e0b", workers: 6, pattern: "21/21" },
          ].map((c) => (
            <div key={c.name} className="border rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="font-semibold text-sm">{c.name}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{c.workers} workers</p>
                <p>Pattern: {c.pattern}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  },
  {
    id: "patterns",
    title: "Rotation Patterns",
    description: "Configure shift rotation schedules",
    icon: Settings,
    duration: "4 min",
    difficulty: "Intermediate",
    href: "/settings",
    steps: [
      {
        title: "Understand Rotation Patterns",
        description: "A rotation pattern defines the cycle: how many days on, days off, and whether shifts alternate between day and night.",
        tip: "Common offshore patterns: 14 on/14 off, 21 on/21 off, 28 on/28 off.",
      },
      {
        title: "Create a Pattern",
        description: "Go to Settings → Rotation Patterns. Click 'Add Pattern' and configure days on, days off, and night shift options.",
      },
      {
        title: "Night Shift Options",
        description: "Enable 'Includes Night Shifts' to split the on-period between day and night shifts. You can set how many days are night shifts, or enable alternating shifts.",
        tip: "With alternating shifts, the pattern automatically switches between day and night each rotation.",
      },
    ],
    demoData: {
      type: "schedule",
      content: (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Example: 14-on / 14-off with 7 night shifts</p>
          <div className="flex gap-0.5 flex-wrap">
            {Array.from({ length: 28 }).map((_, i) => {
              const isOn = i < 14
              const isNight = i >= 7 && i < 14
              return (
                <div
                  key={i}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded text-[10px] font-medium flex items-center justify-center"
                  style={{
                    backgroundColor: !isOn ? "#e5e7eb" : isNight ? "#3b82f6" : "#22c55e",
                    color: !isOn ? "#9ca3af" : "#ffffff",
                  }}
                >
                  {!isOn ? "" : isNight ? "N" : "D"}
                </div>
              )
            })}
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Day</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Night</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Off</span>
          </div>
        </div>
      ),
    },
  },
  {
    id: "setup",
    title: "Generating Schedules",
    description: "Use the Setup wizard to create schedules",
    icon: Wand2,
    duration: "5 min",
    difficulty: "Intermediate",
    href: "/setup",
    steps: [
      {
        title: "Open the Setup Center",
        description: "The Setup page provides a step-by-step workflow. Navigate through the tabs: Patterns → Crews → Workers → Generate.",
      },
      {
        title: "Choose a Start Date",
        description: "Select when the schedule should begin. Choose duration (3, 6, or 12 months), a specific end date, or set it to ongoing.",
      },
      {
        title: "Select Starting Shift",
        description: "Choose whether crews start on day shift or night shift. This determines the initial phase of the rotation.",
      },
      {
        title: "Generate and Review",
        description: "Click 'Generate Schedules' to create the schedule. Review it on the Schedule page and make any manual adjustments as needed.",
        tip: "You can regenerate schedules at any time. Choose whether to keep or clear manual edits when regenerating.",
      },
    ],
  },
  {
    id: "schedule",
    title: "Reading the Schedule",
    description: "Navigate and edit the full-year calendar view",
    icon: Calendar,
    duration: "5 min",
    difficulty: "Intermediate",
    href: "/schedule",
    steps: [
      {
        title: "Full-Year Calendar",
        description: "The schedule shows all workers across all 12 months. Scroll horizontally to see different months, vertically to see more workers.",
        tip: "On mobile, swipe left/right to scroll through months. The worker column stays pinned on the left.",
      },
      {
        title: "Color-Coded Shifts",
        description: "Each shift type has a distinct color: green for Day, blue for Night, gray for Off, and custom colors for special shifts like Training or Vacation.",
      },
      {
        title: "Click to Edit",
        description: "Click any cell to change a worker's shift for that day. A modal lets you pick from all available shift types.",
      },
      {
        title: "Staffing Counts",
        description: "The top rows show daily staffing counts. Red numbers indicate days that fall below minimum staffing requirements.",
        tip: "Enable Focus Mode (expand icon) for a larger view when editing schedules on desktop.",
      },
      {
        title: "Export Schedules",
        description: "Click the Export button to download the schedule as a color-coded Excel file for offline review or printing.",
      },
    ],
    demoData: {
      type: "schedule",
      content: (
        <div className="border rounded-lg overflow-x-auto">
          <div className="min-w-[400px]">
            <div className="grid grid-cols-8 bg-muted/50 text-xs font-medium">
              <div className="p-1.5 sm:p-2 border-r">Worker</div>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="p-1.5 sm:p-2 text-center border-r last:border-r-0">{d}</div>
              ))}
            </div>
            {[
              { name: "J. Smith", shifts: ["D", "D", "D", "D", "D", "D", "D"] },
              { name: "S. Jones", shifts: ["N", "N", "N", "N", "N", "N", "N"] },
              { name: "M. Chen", shifts: ["", "", "", "", "", "", ""] },
            ].map((w) => (
              <div key={w.name} className="grid grid-cols-8 border-t text-xs">
                <div className="p-1.5 sm:p-2 border-r font-medium truncate">{w.name}</div>
                {w.shifts.map((s, j) => (
                  <div key={j} className="p-1 border-r last:border-r-0 flex items-center justify-center">
                    <div
                      className="w-full h-5 sm:h-6 rounded flex items-center justify-center text-white font-medium text-[10px]"
                      style={{
                        backgroundColor: s === "D" ? "#22c55e" : s === "N" ? "#3b82f6" : "#e5e7eb",
                        color: s ? "#fff" : "#9ca3af",
                      }}
                    >
                      {s || "Off"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ),
    },
  },
  {
    id: "timeoff",
    title: "Time-Off Requests",
    description: "Review and manage employee leave requests",
    icon: CalendarOff,
    duration: "3 min",
    difficulty: "Beginner",
    href: "/time-off",
    steps: [
      {
        title: "Submit a Request",
        description: "Workers can submit time-off requests specifying the type (vacation, sick, personal, etc.), date range, and reason.",
      },
      {
        title: "Approve or Deny",
        description: "Admins and supervisors see pending requests and can approve or deny them. Approved requests automatically update the schedule.",
        tip: "Check the staffing counts before approving — make sure you'll still meet minimums.",
      },
      {
        title: "Track Leave History",
        description: "View all past and upcoming time-off in the table. Filter by status to see pending, approved, or denied requests.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    description: "Analyze workforce scheduling data",
    icon: BarChart3,
    duration: "4 min",
    difficulty: "Advanced",
    href: "/reports",
    steps: [
      {
        title: "Scheduling Overview",
        description: "See high-level stats: total shifts scheduled, workers active, average shifts per worker, and time-off usage.",
      },
      {
        title: "Compliance Checking",
        description: "The compliance section flags staffing violations — days that don't meet minimum requirements for each shift type.",
        tip: "Use this to audit your schedule before the rotation starts.",
      },
      {
        title: "Workers by Position",
        description: "See how your workforce breaks down by position. This helps with workforce planning and hiring decisions.",
      },
    ],
  },
  {
    id: "assistant",
    title: "AI Assistant",
    description: "Use natural language to query your schedule",
    icon: Bot,
    duration: "3 min",
    difficulty: "Advanced",
    href: "/assistant",
    steps: [
      {
        title: "Ask Questions",
        description: "Type questions like 'Who is working next Tuesday?' or 'Show me all vacation days in March' to get instant answers.",
      },
      {
        title: "Schedule Actions",
        description: "Ask the assistant to make changes: 'Put John Smith on night shift for January 15-20' or 'Approve all pending time-off requests'.",
        tip: "The assistant understands context — follow up with 'and also add Sarah Jones' without repeating the full request.",
      },
      {
        title: "Conversation History",
        description: "Your conversations are saved. Come back anytime to review previous queries and answers.",
      },
    ],
  },
  {
    id: "admin",
    title: "Admin & Security",
    description: "Organization settings and access control",
    icon: Shield,
    duration: "4 min",
    difficulty: "Advanced",
    href: "/settings",
    steps: [
      {
        title: "Organization Settings",
        description: "Update your organization name, configure notification preferences (email, SMS, staffing alerts), and manage shift colors.",
      },
      {
        title: "Staffing Rules",
        description: "Set minimum staffing requirements per shift. ShiftSync will alert you whenever a day falls below these thresholds.",
        tip: "Configure separate minimums for operators and control room staff if your operation requires it.",
      },
      {
        title: "Custom Shift Types",
        description: "Add shift types beyond the built-in ones (Day, Night, Off, Leave, etc.). Create shifts like 'Training', 'Shutdown', or anything your operation needs.",
      },
      {
        title: "User Roles & Permissions",
        description: "Admins have full access. Supervisors can manage schedules and workers. Workers can view schedules and submit time-off requests.",
      },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────────

export default function TrainingPage() {
  const [expandedModule, setExpandedModule] = useState<string | null>("overview")
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set())

  const toggleModule = (id: string) => {
    setExpandedModule(expandedModule === id ? null : id)
  }

  const markComplete = (id: string) => {
    setCompletedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const completedCount = completedModules.size
  const totalCount = trainingModules.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const difficultyColor = (d: string) => {
    switch (d) {
      case "Beginner": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
      case "Intermediate": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
      case "Advanced": return "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
      default: return ""
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Training Plan
          </h1>
          <p className="text-muted-foreground mt-1">
            Step-by-step guide to mastering ShiftSync
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/setup">
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Jump to Setup
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Your Progress
                </h3>
                <span className="text-sm text-muted-foreground">
                  {completedCount} of {totalCount} modules
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
            {completedCount === totalCount && totalCount > 0 && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 whitespace-nowrap">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Training Complete!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Tips */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Quick Start Workflow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center">
            {[
              { step: "1", label: "Add Workers", icon: Users },
              { step: "2", label: "Create Crews", icon: Users2 },
              { step: "3", label: "Set Patterns", icon: Settings },
              { step: "4", label: "Generate", icon: Wand2 },
              { step: "5", label: "Review", icon: Calendar },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border min-h-[44px]">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {s.step}
                  </div>
                  <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                {i < 4 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0 mx-1" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Training Modules */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Training Modules</h2>

        {trainingModules.map((mod, index) => {
          const isExpanded = expandedModule === mod.id
          const isComplete = completedModules.has(mod.id)
          const ModIcon = mod.icon

          return (
            <Card key={mod.id} className={isComplete ? "border-green-200 dark:border-green-900" : ""}>
              {/* Module Header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full text-left p-4 sm:p-5 flex items-start gap-3 sm:gap-4 min-h-[44px]"
              >
                <div className="shrink-0 mt-0.5">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-muted-foreground">{index + 1}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <h3 className={`font-semibold flex items-center gap-2 ${isComplete ? "text-green-700 dark:text-green-400" : ""}`}>
                      <ModIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{mod.title}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${difficultyColor(mod.difficulty)}`}>
                        {mod.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {mod.duration}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{mod.description}</p>
                </div>
                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Module Content (expanded) */}
              {isExpanded && (
                <CardContent className="pt-0 px-4 sm:px-5 pb-4 sm:pb-5">
                  <div className="border-t pt-4 space-y-4">
                    {/* Steps */}
                    <div className="space-y-3">
                      {mod.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex gap-3">
                          <div className="shrink-0 mt-1">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {stepIndex + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{step.title}</h4>
                            <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                            {step.tip && (
                              <div className="mt-2 flex gap-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900">
                                <Lightbulb className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-800 dark:text-yellow-300">{step.tip}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Interactive Demo */}
                    {mod.demoData && (
                      <div className="border rounded-lg p-3 sm:p-4 bg-muted/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Live Preview
                        </p>
                        {mod.demoData.content}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                      <Link href={mod.href} className="flex-1">
                        <Button variant="outline" className="w-full gap-2 min-h-[44px]">
                          <ArrowRight className="h-4 w-4" />
                          Go to {mod.title}
                        </Button>
                      </Link>
                      <Button
                        variant={isComplete ? "secondary" : "default"}
                        className="gap-2 min-h-[44px]"
                        onClick={(e) => {
                          e.stopPropagation()
                          markComplete(mod.id)
                        }}
                      >
                        {isComplete ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Circle className="h-4 w-4" />
                            Mark Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Additional Resources
          </CardTitle>
          <CardDescription>Helpful links to get the most out of ShiftSync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link href="/setup" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <Wand2 className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Setup Wizard</p>
                <p className="text-xs text-muted-foreground truncate">Step-by-step schedule creation</p>
              </div>
            </Link>
            <Link href="/assistant" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">AI Assistant</p>
                <p className="text-xs text-muted-foreground truncate">Ask questions in natural language</p>
              </div>
            </Link>
            <Link href="/settings" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <Settings className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Settings</p>
                <p className="text-xs text-muted-foreground truncate">Configure patterns, rules, and roles</p>
              </div>
            </Link>
            <Link href="/reports" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <BarChart3 className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Reports</p>
                <p className="text-xs text-muted-foreground truncate">Analytics and compliance checking</p>
              </div>
            </Link>
            <Link href="/schedule" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <Download className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Excel Export</p>
                <p className="text-xs text-muted-foreground truncate">Download color-coded schedules</p>
              </div>
            </Link>
            <Link href="/time-off" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors min-h-[44px]">
              <Bell className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Notifications</p>
                <p className="text-xs text-muted-foreground truncate">Stay on top of requests and alerts</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

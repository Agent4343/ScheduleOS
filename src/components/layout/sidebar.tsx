"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Calendar,
  LayoutDashboard,
  Users,
  Users2,
  Clock,
  Settings,
  CalendarOff,
  BarChart3,
  Wand2,
  Bot,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react"
import { useOnboarding } from "@/contexts/onboarding-context"
import { useState } from "react"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  tourId: string
  requiredProgress?: "basic" | "advanced"
  badge?: string
}

const coreNavigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
  { name: "Setup", href: "/setup", icon: Wand2, tourId: "setup", badge: "Start here" },
  { name: "Workers", href: "/workers", icon: Users, tourId: "workers" },
  { name: "Crews", href: "/crews", icon: Users2, tourId: "crews" },
]

const advancedNavigation: NavItem[] = [
  { name: "Schedule", href: "/schedule", icon: Calendar, tourId: "schedule", requiredProgress: "basic" },
  { name: "Time Off", href: "/time-off", icon: CalendarOff, tourId: "time-off", requiredProgress: "basic" },
  { name: "Reports", href: "/reports", icon: BarChart3, tourId: "reports", requiredProgress: "advanced" },
  { name: "AI Assistant", href: "/assistant", icon: Bot, tourId: "assistant", requiredProgress: "advanced" },
  { name: "Settings", href: "/settings", icon: Settings, tourId: "settings" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { state, loading } = useOnboarding()
  const [showAdvanced, setShowAdvanced] = useState(true)

  const hasBasicSetup = state?.checklist?.addWorkers || false
  const hasAdvancedSetup = state?.checklist?.generateSchedules || false
  const isOnboardingComplete = state?.isOnboardingComplete || false

  const renderNavItem = (item: NavItem, isLocked: boolean = false) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
    const showNewBadge = item.badge && !isOnboardingComplete && !hasBasicSetup

    return (
      <Link
        key={item.name}
        href={isLocked ? "#" : item.href}
        data-tour={item.tourId}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
          isActive
            ? "bg-primary text-primary-foreground"
            : isLocked
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        onClick={isLocked ? (e) => e.preventDefault() : undefined}
      >
        <item.icon className="h-5 w-5" />
        {item.name}
        {showNewBadge && (
          <span className="absolute right-2 flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <Sparkles className="h-3 w-3" />
            {item.badge}
          </span>
        )}
        {isLocked && (
          <span className="absolute right-2 text-xs text-muted-foreground/50">
            Locked
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-card hidden lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Clock className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">ShiftSync</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {/* Core Navigation */}
          <div className="space-y-1">
            {coreNavigation.map((item) => renderNavItem(item))}
          </div>

          {/* Advanced Navigation - Progressive disclosure */}
          {!loading && (
            <>
              <div className="my-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  <span>
                    {isOnboardingComplete ? "More" : "Unlock with progress"}
                  </span>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-1">
                  {advancedNavigation.map((item) => {
                    let isLocked = false

                    if (!isOnboardingComplete) {
                      if (item.requiredProgress === "basic" && !hasBasicSetup) {
                        isLocked = true
                      } else if (item.requiredProgress === "advanced" && !hasAdvancedSetup) {
                        isLocked = true
                      }
                    }

                    return renderNavItem(item, isLocked)
                  })}
                </div>
              )}
            </>
          )}

          {/* Onboarding progress indicator */}
          {!loading && !isOnboardingComplete && state && (
            <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Setup Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(state.completedSteps / state.totalSteps) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {state.completedSteps}/{state.totalSteps}
                </span>
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">
            ShiftSync v1.0.0
          </p>
        </div>
      </div>
    </aside>
  )
}

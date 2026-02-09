"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useCallback } from "react"
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
  X,
  Sparkles,
} from "lucide-react"
import { useOnboarding } from "@/contexts/onboarding-context"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  requiredProgress?: "basic" | "advanced"
  badge?: string
}

const coreNavigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Setup", href: "/setup", icon: Wand2, badge: "Start here" },
  { name: "Workers", href: "/workers", icon: Users },
  { name: "Crews", href: "/crews", icon: Users2 },
]

const advancedNavigation: NavItem[] = [
  { name: "Schedule", href: "/schedule", icon: Calendar, requiredProgress: "basic" },
  { name: "Time Off", href: "/time-off", icon: CalendarOff, requiredProgress: "basic" },
  { name: "Reports", href: "/reports", icon: BarChart3, requiredProgress: "advanced" },
  { name: "AI Assistant", href: "/assistant", icon: Bot, requiredProgress: "advanced" },
  { name: "Settings", href: "/settings", icon: Settings },
]

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLElement>(null)
  const touchStartX = useRef<number>(0)
  const touchCurrentX = useRef<number>(0)
  const isDragging = useRef(false)
  const { state, loading } = useOnboarding()

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
        onClick={isLocked ? (e) => e.preventDefault() : onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors relative min-h-[44px]",
          isActive
            ? "bg-primary text-primary-foreground"
            : isLocked
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {item.name}
        {showNewBadge && (
          <span className="absolute right-2 flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <Sparkles className="h-3 w-3" />
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

  // Close on route change
  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  // Swipe-to-close gesture handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
    isDragging.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    touchCurrentX.current = e.touches[0].clientX
    const diff = touchStartX.current - touchCurrentX.current

    // Only allow swiping left (to close)
    if (diff > 0 && sidebarRef.current) {
      const translateX = Math.min(diff, 256)
      sidebarRef.current.style.transform = `translateX(-${translateX}px)`
      sidebarRef.current.style.transition = "none"
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    const diff = touchStartX.current - touchCurrentX.current

    if (sidebarRef.current) {
      sidebarRef.current.style.transition = ""
      sidebarRef.current.style.transform = ""
    }

    // Close if swiped more than 80px to the left
    if (diff > 80) {
      onClose()
    }
  }, [onClose])

  // Trap focus within mobile nav when open
  useEffect(() => {
    if (!isOpen) return

    const sidebar = sidebarRef.current
    if (!sidebar) return

    const focusableElements = sidebar.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleTab)
    // Focus the close button when opened
    firstFocusable?.focus()

    return () => document.removeEventListener("keydown", handleTab)
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 lg:hidden transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card lg:hidden transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">ShiftSync</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
            {/* Core Navigation */}
            <div className="space-y-1">
              {coreNavigation.map((item) => renderNavItem(item))}
            </div>

            {/* Divider */}
            {!loading && (
              <>
                <div className="my-4 border-t" />
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isOnboardingComplete ? "More" : "Unlock with progress"}
                </p>

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
        </div>
      </aside>
    </>
  )
}

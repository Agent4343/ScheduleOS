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
  X,
} from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Setup", href: "/setup", icon: Wand2 },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Workers", href: "/workers", icon: Users },
  { name: "Crews", href: "/crews", icon: Users2 },
  { name: "Time Off", href: "/time-off", icon: CalendarOff },
  { name: "Reports", href: "/reports", icon: BarChart3 },
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
          <nav className="flex-1 space-y-1 p-4" aria-label="Main navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>
    </>
  )
}

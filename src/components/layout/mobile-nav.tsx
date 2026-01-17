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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card lg:hidden animate-in slide-in-from-left">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <Clock className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">ShiftSync</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
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

"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Calendar,
  LayoutDashboard,
  Users,
  CalendarOff,
  MoreHorizontal,
} from "lucide-react"

const bottomNavItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Workers", href: "/workers", icon: Users },
  { name: "Time Off", href: "/time-off", icon: CalendarOff },
  { name: "More", href: "/settings", icon: MoreHorizontal },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card lg:hidden safe-area-bottom"
      aria-label="Quick navigation"
    >
      <div className="flex items-center justify-around">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-3 min-h-[56px] min-w-[64px] justify-center transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium leading-none">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

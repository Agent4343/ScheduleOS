import {
  Calendar,
  LayoutDashboard,
  Users,
  Users2,
  ClipboardCheck,
  CalendarOff,
  ArrowLeftRight,
  Megaphone,
  BarChart3,
  Shield,
  Bot,
  Rocket,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type Role = "ADMIN" | "SUPERVISOR" | "WORKER"

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  /** Roles that can see and open this page. */
  roles: Role[]
}

const EVERYONE: Role[] = ["ADMIN", "SUPERVISOR", "WORKER"]
export const STAFF: Role[] = ["ADMIN", "SUPERVISOR"]

/**
 * Primary navigation, in display order. The same list drives the sidebar,
 * the mobile drawer, and the (staff) route-group guard, so a page cannot be
 * hidden from the menu yet reachable by URL.
 *
 * Onboarding lives at /getting-started (a checklist that reuses the real pages' dialogs).
 */
export const navigation: NavItem[] = [
  { name: "Getting Started", href: "/getting-started", icon: Rocket, roles: STAFF },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: EVERYONE },
  { name: "Schedule", href: "/schedule", icon: Calendar, roles: EVERYONE },
  { name: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: EVERYONE },
  { name: "Workers", href: "/workers", icon: Users, roles: STAFF },
  { name: "Crews", href: "/crews", icon: Users2, roles: STAFF },
  { name: "Time Off", href: "/time-off", icon: CalendarOff, roles: EVERYONE },
  { name: "Shift Swaps", href: "/shift-swaps", icon: ArrowLeftRight, roles: EVERYONE },
  { name: "Announcements", href: "/announcements", icon: Megaphone, roles: EVERYONE },
  { name: "Reports", href: "/reports", icon: BarChart3, roles: STAFF },
  { name: "Audit Log", href: "/audit-log", icon: Shield, roles: ["ADMIN"] },
  { name: "AI Assistant", href: "/assistant", icon: Bot, roles: STAFF },
  { name: "Settings", href: "/settings", icon: Settings, roles: EVERYONE },
]

/** Items a user with `role` may see. Unknown/undefined role sees the WORKER set. */
export function navForRole(role: Role | undefined | null): NavItem[] {
  const r: Role = role ?? "WORKER"
  return navigation.filter((item) => item.roles.includes(r))
}

/** Title for the current page, for the header. */
export function pageTitle(pathname: string): string | undefined {
  return navigation.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.name
}

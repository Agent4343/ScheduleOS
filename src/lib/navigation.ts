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

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

// Primary navigation items shown in sidebar and mobile nav.
// Setup is excluded — it's a one-time onboarding wizard, not an ongoing tool.
export const navigation: NavItem[] = [
  { name: "Getting Started", href: "/getting-started", icon: Rocket },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Attendance", href: "/attendance", icon: ClipboardCheck },
  { name: "Workers", href: "/workers", icon: Users, adminOnly: true },
  { name: "Crews", href: "/crews", icon: Users2, adminOnly: true },
  { name: "Time Off", href: "/time-off", icon: CalendarOff },
  { name: "Shift Swaps", href: "/shift-swaps", icon: ArrowLeftRight },
  { name: "Announcements", href: "/announcements", icon: Megaphone },
  { name: "Reports", href: "/reports", icon: BarChart3, adminOnly: true },
  { name: "Audit Log", href: "/audit-log", icon: Shield, adminOnly: true },
  { name: "AI Assistant", href: "/assistant", icon: Bot },
  { name: "Settings", href: "/settings", icon: Settings },
]

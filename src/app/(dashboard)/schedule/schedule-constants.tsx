import { Sun, Moon } from "lucide-react"
import { ShiftType } from "@/types"

// Position-based color coding for offshore operations
export const POSITION_COLORS: Record<string, string> = {
  // Leadership
  "OIM": "bg-purple-700",
  "Production Supervisor": "bg-purple-600",
  "Production Lead": "bg-purple-500",

  // Control Room
  "OCR Operator": "bg-teal-500",
  "CCR Operator": "bg-cyan-600",

  // Field Operations
  "Ops Tech": "bg-blue-500",

  // Legacy/Generic
  "Operator": "bg-blue-500",
  "Senior Operator": "bg-blue-600",
  "Lead Operator": "bg-blue-700",
  "Technician": "bg-green-500",
  "Senior Technician": "bg-green-600",
  "Lead Technician": "bg-green-700",
  "Supervisor": "bg-purple-500",
  "Manager": "bg-purple-700",
  "Engineer": "bg-orange-500",
  "Maintenance": "bg-yellow-500",
  "Safety": "bg-red-500",
  "Quality": "bg-pink-500",
  "Logistics": "bg-cyan-500",
  "default": "bg-gray-500",
}

// Shift colors for all offshore shift types
export const SHIFT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Field Operations
  DAY: { bg: "bg-green-500", text: "text-white", border: "border-green-600" },
  NIGHT: { bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },

  // Control Room
  OCR_DAY: { bg: "bg-teal-500", text: "text-white", border: "border-teal-600" },
  OCR_NIGHT: { bg: "bg-indigo-600", text: "text-white", border: "border-indigo-700" },
  CCR_DAY: { bg: "bg-cyan-500", text: "text-white", border: "border-cyan-600" },
  CCR_NIGHT: { bg: "bg-purple-600", text: "text-white", border: "border-purple-700" },

  // Backfill/Acting Roles
  PS: { bg: "bg-amber-500", text: "text-white", border: "border-amber-600" },
  PL_DAY: { bg: "bg-orange-400", text: "text-white", border: "border-orange-500" },
  PL_NIGHT: { bg: "bg-orange-600", text: "text-white", border: "border-orange-700" },

  // Non-operational
  TRAINING: { bg: "bg-yellow-300", text: "text-yellow-900", border: "border-yellow-400" },
  OSCC: { bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600" },

  // Absence
  OFF: { bg: "", text: "text-transparent", border: "" }, // Blank for OFF days
  LEAVE: { bg: "bg-gray-400", text: "text-white", border: "border-gray-500" },
  SICK: { bg: "bg-red-400", text: "text-red-900", border: "border-red-500" },
  VACATION: { bg: "bg-emerald-400", text: "text-emerald-900", border: "border-emerald-500" },

  // Other
  SHUTDOWN: { bg: "bg-slate-500", text: "text-white", border: "border-slate-600" },
}

// Shift abbreviations for display
export const SHIFT_ABBREV: Record<string, string> = {
  DAY: "D",
  NIGHT: "N",
  OCR_DAY: "OR",
  OCR_NIGHT: "OR",
  CCR_DAY: "CR",
  CCR_NIGHT: "CR",
  PS: "PS",
  PL_DAY: "PL",
  PL_NIGHT: "PL",
  TRAINING: "TR",
  OSCC: "OS",
  OFF: "",
  LEAVE: "L",
  SICK: "SL",
  VACATION: "V",
  SHUTDOWN: "X",
}

export const SHIFT_ICONS: Record<string, React.ReactNode> = {
  DAY: <Sun className="h-3 w-3" />,
  NIGHT: <Moon className="h-3 w-3" />,
  OCR_DAY: <Sun className="h-3 w-3" />,
  OCR_NIGHT: <Moon className="h-3 w-3" />,
  CCR_DAY: <Sun className="h-3 w-3" />,
  CCR_NIGHT: <Moon className="h-3 w-3" />,
  OFF: null,
  LEAVE: null,
  VACATION: null,
  SICK: null,
  TRAINING: null,
  OSCC: null,
  SHUTDOWN: null,
  PS: null,
  PL_DAY: null,
  PL_NIGHT: null,
}

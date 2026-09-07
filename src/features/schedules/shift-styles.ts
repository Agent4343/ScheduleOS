import type { Schedule, ShiftType } from "@/features/types"
import type { CustomShiftType } from "@/features/custom-shift-types/hooks"

export interface ShiftStyle {
  bg: string
  text: string
  label: string
  name: string
}

/** Built-in shift colours and the one-letter labels shown in grid cells. */
export const BUILT_IN_SHIFT_STYLES: Record<string, ShiftStyle> = {
  DAY: { bg: "#22c55e", text: "#ffffff", label: "D", name: "Day" },
  NIGHT: { bg: "#2563eb", text: "#ffffff", label: "N", name: "Night" },
  OFF: { bg: "#e5e7eb", text: "#6b7280", label: "O", name: "Off" },
  LEAVE: { bg: "#f97316", text: "#ffffff", label: "L", name: "Leave" },
  PL_DAY: { bg: "#14b8a6", text: "#ffffff", label: "PD", name: "PL Day" },
  PL_NIGHT: { bg: "#6366f1", text: "#ffffff", label: "PN", name: "PL Night" },
  VACATION: { bg: "#10b981", text: "#ffffff", label: "V", name: "Vacation" },
  SICK: { bg: "#ef4444", text: "#ffffff", label: "S", name: "Sick" },
  TRAINING: { bg: "#eab308", text: "#000000", label: "T", name: "Training" },
  SHUTDOWN: { bg: "#64748b", text: "#ffffff", label: "X", name: "Shutdown" },
}

/**
 * A "shift key" identifies what to draw in a cell: a built-in ShiftType, or
 * `CUSTOM:<code>` for an organization's custom type.
 */
export type ShiftKey = string

export function shiftKeyOf(schedule: Pick<Schedule, "shiftType" | "customShiftCode">): ShiftKey {
  return schedule.shiftType === "CUSTOM" && schedule.customShiftCode
    ? `CUSTOM:${schedule.customShiftCode}`
    : schedule.shiftType
}

/** Split a shift key back into what the API wants. */
export function shiftKeyToApi(key: ShiftKey): { shiftType: ShiftType; customShiftCode: string | null } {
  if (key.startsWith("CUSTOM:")) return { shiftType: "CUSTOM", customShiftCode: key.slice("CUSTOM:".length) }
  return { shiftType: key as ShiftType, customShiftCode: null }
}

/** Built-in styles plus the organization's active custom types (and any colour overrides). */
export function mergeShiftStyles(
  customTypes: CustomShiftType[] = [],
  colorOverrides: Record<string, { bg: string; text: string }> = {}
): Record<ShiftKey, ShiftStyle> {
  const styles: Record<ShiftKey, ShiftStyle> = {}
  for (const [key, style] of Object.entries(BUILT_IN_SHIFT_STYLES)) {
    styles[key] = { ...style, ...(colorOverrides[key] ?? {}) }
  }
  for (const t of customTypes) {
    if (!t.isActive) continue
    styles[`CUSTOM:${t.code}`] = { bg: t.color, text: t.textColor, label: t.code, name: t.name }
  }
  return styles
}

/** Shift keys a person may assign by hand, in the order the picker shows them. */
export const ASSIGNABLE_SHIFT_KEYS: ShiftKey[] = [
  "SICK", "VACATION", "LEAVE", "DAY", "NIGHT", "OFF", "PL_DAY", "PL_NIGHT", "TRAINING", "SHUTDOWN",
]

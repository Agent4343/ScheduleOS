import type { PositionForm, NewPatternForm } from "./settings-types"

export const CATEGORY_OPTIONS = [
  { value: "Leadership", label: "Leadership" },
  { value: "Control Room", label: "Control Room" },
  { value: "Field Ops", label: "Field Ops" },
]

export const SHIFT_TYPE_OPTIONS = [
  { value: "day", label: "Day Shift" },
  { value: "night", label: "Night Shift" },
  { value: "24hr", label: "24-Hour (On-Call)" },
]

export const INITIAL_POSITION_FORM: PositionForm = {
  name: "",
  code: "",
  category: "Field Ops",
  shiftType: "day",
  minStaffing: 1,
  maxStaffing: 1,
  sortOrder: 0,
}

export const INITIAL_PATTERN_FORM: NewPatternForm = {
  name: "",
  daysOn: 21,
  daysOff: 21,
  includesNights: true,
}

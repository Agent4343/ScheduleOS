export const ShiftType = {
  DAY: 'DAY',
  NIGHT: 'NIGHT',
  OFF: 'OFF',
  SHUTDOWN: 'SHUTDOWN',
  LEAVE: 'LEAVE',
  SICK: 'SICK',
  VACATION: 'VACATION',
  TRAINING: 'TRAINING',
  OSCC: 'OSCC',
  OCR_DAY: 'OCR_DAY',
  OCR_NIGHT: 'OCR_NIGHT',
  CCR_DAY: 'CCR_DAY',
  CCR_NIGHT: 'CCR_NIGHT',
  PS: 'PS',
  PL_DAY: 'PL_DAY',
  PL_NIGHT: 'PL_NIGHT',
} as const

export type ShiftType = typeof ShiftType[keyof typeof ShiftType]

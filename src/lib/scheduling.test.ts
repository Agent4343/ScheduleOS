import { describe, it, expect } from 'vitest'
import { ShiftType } from '@prisma/client'
import {
  generateRotationSchedule,
  calculateCurrentPhase,
  getCrewPhaseOffset,
  calculateStaffingLevels,
  findStaffingGaps,
  calculateOnboardingSync,
  applyShutdown,
  standardPatterns,
  RotationPattern,
  GeneratedSchedule,
  StaffingLevel,
} from './scheduling'

// Helper to create dates without time component for consistent comparisons
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

// Helper to extract just shift types from a schedule
function getShiftTypes(schedules: GeneratedSchedule[]): ShiftType[] {
  return schedules.map(s => s.shiftType)
}

describe('generateRotationSchedule', () => {
  describe('basic day-only rotation patterns', () => {
    it('generates correct schedule for 3on3off pattern starting at phase 0', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 12) // 12 days = 2 full cycles

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(12)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.DAY, ShiftType.DAY, ShiftType.DAY, // Days 1-3: working
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Days 4-6: off
        ShiftType.DAY, ShiftType.DAY, ShiftType.DAY, // Days 7-9: working
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Days 10-12: off
      ])
    })

    it('generates correct schedule for 2on2off pattern', () => {
      const pattern: RotationPattern = {
        daysOn: 2,
        daysOff: 2,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 8) // 8 days = 2 full cycles

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(8)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.DAY, ShiftType.DAY,   // Days 1-2: working
        ShiftType.OFF, ShiftType.OFF,   // Days 3-4: off
        ShiftType.DAY, ShiftType.DAY,   // Days 5-6: working
        ShiftType.OFF, ShiftType.OFF,   // Days 7-8: off
      ])
    })

    it('generates correct schedule for 7on7off pattern', () => {
      const pattern: RotationPattern = {
        daysOn: 7,
        daysOff: 7,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 14) // 14 days = 1 full cycle

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(14)

      // First 7 days should be DAY shifts
      for (let i = 0; i < 7; i++) {
        expect(schedules[i].shiftType).toBe(ShiftType.DAY)
      }
      // Next 7 days should be OFF
      for (let i = 7; i < 14; i++) {
        expect(schedules[i].shiftType).toBe(ShiftType.OFF)
      }
    })
  })

  describe('rotation patterns with night shifts', () => {
    it('generates correct schedule for 3on3off with nights at start (2 nights)', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: true,
        nightsAtStart: true,
        nightDays: 2,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6) // 6 days = 1 full cycle

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.NIGHT, ShiftType.NIGHT, // First 2 working days are nights
        ShiftType.DAY,                     // Last working day is day shift
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Off days
      ])
    })

    it('generates correct schedule for 3on3off with nights at end (days first)', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: true,
        nightsAtStart: false,
        nightDays: 1,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6) // 6 days = 1 full cycle

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.DAY, ShiftType.DAY,    // First 2 working days are day shifts
        ShiftType.NIGHT,                  // Last working day is night shift
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Off days
      ])
    })

    it('generates correct schedule for 2on2off with 1 night at start', () => {
      const pattern: RotationPattern = {
        daysOn: 2,
        daysOff: 2,
        includesNights: true,
        nightsAtStart: true,
        nightDays: 1,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 4) // 4 days = 1 full cycle

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(4)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.NIGHT,  // First working day is night
        ShiftType.DAY,    // Second working day is day
        ShiftType.OFF, ShiftType.OFF, // Off days
      ])
    })

    it('generates correct schedule for 14on14off with 7 nights at start', () => {
      const pattern: RotationPattern = {
        daysOn: 14,
        daysOff: 14,
        includesNights: true,
        nightsAtStart: true,
        nightDays: 7,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 28) // 28 days = 1 full cycle

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(28)

      // First 7 days should be NIGHT shifts
      for (let i = 0; i < 7; i++) {
        expect(schedules[i].shiftType).toBe(ShiftType.NIGHT)
      }
      // Next 7 days should be DAY shifts
      for (let i = 7; i < 14; i++) {
        expect(schedules[i].shiftType).toBe(ShiftType.DAY)
      }
      // Next 14 days should be OFF
      for (let i = 14; i < 28; i++) {
        expect(schedules[i].shiftType).toBe(ShiftType.OFF)
      }
    })
  })

  describe('phase offset handling', () => {
    it('starts mid-cycle when phase offset is provided (starting at off days)', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      // Start at phase 3 (first off day)
      const schedules = generateRotationSchedule(pattern, startDate, endDate, 3)

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Start with off days
        ShiftType.DAY, ShiftType.DAY, ShiftType.DAY, // Then work days
      ])
    })

    it('starts at last working day when phase is 2 in 3on3off', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      // Start at phase 2 (last working day)
      const schedules = generateRotationSchedule(pattern, startDate, endDate, 2)

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.DAY,                               // Last working day of previous cycle
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Off days
        ShiftType.DAY, ShiftType.DAY,                // Start of next cycle
      ])
    })

    it('handles phase offset larger than cycle length (wraps around)', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      // Phase 9 should be same as phase 3 (9 % 6 = 3)
      const schedulesPhase3 = generateRotationSchedule(pattern, startDate, endDate, 3)
      const schedulesPhase9 = generateRotationSchedule(pattern, startDate, endDate, 9)

      expect(getShiftTypes(schedulesPhase3)).toEqual(getShiftTypes(schedulesPhase9))
    })

    it('starts in the middle of night shifts with phase offset', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: true,
        nightsAtStart: true,
        nightDays: 2,
      }

      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      // Start at phase 1 (second night)
      const schedules = generateRotationSchedule(pattern, startDate, endDate, 1)

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.NIGHT,                             // Second night shift
        ShiftType.DAY,                               // Day shift
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF, // Off days
        ShiftType.NIGHT,                             // Back to first night of new cycle
      ])
    })
  })

  describe('date handling', () => {
    it('generates correct dates for each schedule entry', () => {
      const pattern: RotationPattern = {
        daysOn: 2,
        daysOff: 2,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 15)
      const endDate = createDate(2025, 1, 18)

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(4)
      expect(schedules[0].date.getDate()).toBe(15)
      expect(schedules[1].date.getDate()).toBe(16)
      expect(schedules[2].date.getDate()).toBe(17)
      expect(schedules[3].date.getDate()).toBe(18)
    })

    it('handles month boundary crossing', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 30)
      const endDate = createDate(2025, 2, 3)

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(5)
      expect(schedules[0].date.getMonth()).toBe(0) // January (0-indexed)
      expect(schedules[0].date.getDate()).toBe(30)
      expect(schedules[1].date.getMonth()).toBe(0)
      expect(schedules[1].date.getDate()).toBe(31)
      expect(schedules[2].date.getMonth()).toBe(1) // February
      expect(schedules[2].date.getDate()).toBe(1)
    })

    it('handles year boundary crossing', () => {
      const pattern: RotationPattern = {
        daysOn: 2,
        daysOff: 2,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 12, 30)
      const endDate = createDate(2026, 1, 2)

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(4)
      expect(schedules[0].date.getFullYear()).toBe(2025)
      expect(schedules[2].date.getFullYear()).toBe(2026)
    })

    it('handles leap year (Feb 29)', () => {
      const pattern: RotationPattern = {
        daysOn: 2,
        daysOff: 2,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2024, 2, 28) // 2024 is a leap year
      const endDate = createDate(2024, 3, 1)

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(3)
      expect(schedules[0].date.getDate()).toBe(28) // Feb 28
      expect(schedules[1].date.getDate()).toBe(29) // Feb 29 (leap day)
      expect(schedules[2].date.getMonth()).toBe(2) // March (0-indexed)
      expect(schedules[2].date.getDate()).toBe(1)  // March 1
    })

    it('returns empty array when end date is before start date', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const startDate = createDate(2025, 1, 10)
      const endDate = createDate(2025, 1, 5)

      const schedules = generateRotationSchedule(pattern, startDate, endDate, 0)

      expect(schedules).toHaveLength(0)
    })

    it('returns single entry when start and end dates are the same', () => {
      const pattern: RotationPattern = {
        daysOn: 3,
        daysOff: 3,
        includesNights: false,
        nightsAtStart: false,
        nightDays: 0,
      }

      const date = createDate(2025, 1, 1)

      const schedules = generateRotationSchedule(pattern, date, date, 0)

      expect(schedules).toHaveLength(1)
      expect(schedules[0].shiftType).toBe(ShiftType.DAY)
    })
  })

  describe('standard patterns', () => {
    it('generates correct schedule using standardPatterns["3on3off"]', () => {
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      const schedules = generateRotationSchedule(
        standardPatterns['3on3off'],
        startDate,
        endDate,
        0
      )

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.DAY, ShiftType.DAY, ShiftType.DAY,
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF,
      ])
    })

    it('generates correct schedule using standardPatterns["3on3off-nights"]', () => {
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 6)

      const schedules = generateRotationSchedule(
        standardPatterns['3on3off-nights'],
        startDate,
        endDate,
        0
      )

      expect(schedules).toHaveLength(6)
      expect(getShiftTypes(schedules)).toEqual([
        ShiftType.NIGHT, ShiftType.NIGHT, ShiftType.DAY,
        ShiftType.OFF, ShiftType.OFF, ShiftType.OFF,
      ])
    })
  })
})

describe('calculateCurrentPhase', () => {
  it('returns 0 when target date equals rotation start date', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 1)
    const targetDate = createDate(2025, 1, 1)

    const phase = calculateCurrentPhase(rotationStart, targetDate, pattern)

    expect(phase).toBe(0)
  })

  it('returns correct phase for target date within first cycle', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 1)

    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 2), pattern)).toBe(1)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 3), pattern)).toBe(2)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 4), pattern)).toBe(3)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 5), pattern)).toBe(4)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 6), pattern)).toBe(5)
  })

  it('wraps phase correctly after one full cycle', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 1)

    // Day 7 should be back to phase 0
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 7), pattern)).toBe(0)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 8), pattern)).toBe(1)
  })

  it('calculates phase correctly for target date many cycles in the future', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 1)

    // 60 days later = 10 cycles, should be at phase 0
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 3, 2), pattern)).toBe(0)

    // 61 days later should be at phase 1
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 3, 3), pattern)).toBe(1)
  })

  it('handles target date before rotation start date (negative days)', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 10)
    const targetDate = createDate(2025, 1, 7) // 3 days before

    // -3 days -> should wrap to phase 3 (start of off days)
    const phase = calculateCurrentPhase(rotationStart, targetDate, pattern)

    expect(phase).toBe(3)
  })

  it('works with different cycle lengths', () => {
    const pattern: RotationPattern = {
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const rotationStart = createDate(2025, 1, 1)

    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 15), pattern)).toBe(14)
    expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 29), pattern)).toBe(0) // Back to start
  })
})

describe('getCrewPhaseOffset', () => {
  it('returns 0 for first crew (index 0)', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    expect(getCrewPhaseOffset(0, pattern)).toBe(0)
  })

  it('returns half-cycle offset for second crew (index 1)', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    // Total cycle = 6 days, half = 3
    expect(getCrewPhaseOffset(1, pattern)).toBe(3)
  })

  it('returns correct offsets for 4 crews in 3on3off pattern', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    // With total cycle of 6 and formula (crewIndex * 6) / 2 % 6:
    // Crew 0: 0 * 6 / 2 = 0
    // Crew 1: 1 * 6 / 2 = 3
    // Crew 2: 2 * 6 / 2 = 6 % 6 = 0
    // Crew 3: 3 * 6 / 2 = 9 % 6 = 3
    expect(getCrewPhaseOffset(0, pattern)).toBe(0)
    expect(getCrewPhaseOffset(1, pattern)).toBe(3)
    expect(getCrewPhaseOffset(2, pattern)).toBe(0)
    expect(getCrewPhaseOffset(3, pattern)).toBe(3)
  })

  it('returns correct offsets for 2on2off pattern', () => {
    const pattern: RotationPattern = {
      daysOn: 2,
      daysOff: 2,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    // Total cycle = 4, offset = (crewIndex * 4) / 2 % 4
    expect(getCrewPhaseOffset(0, pattern)).toBe(0)
    expect(getCrewPhaseOffset(1, pattern)).toBe(2)
    expect(getCrewPhaseOffset(2, pattern)).toBe(0)
    expect(getCrewPhaseOffset(3, pattern)).toBe(2)
  })

  it('returns correct offsets for 14on14off pattern', () => {
    const pattern: RotationPattern = {
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    // Total cycle = 28, offset = (crewIndex * 28) / 2 % 28
    expect(getCrewPhaseOffset(0, pattern)).toBe(0)
    expect(getCrewPhaseOffset(1, pattern)).toBe(14)
    expect(getCrewPhaseOffset(2, pattern)).toBe(0)
    expect(getCrewPhaseOffset(3, pattern)).toBe(14)
  })
})

describe('calculateStaffingLevels', () => {
  it('calculates correct staffing for single worker on day shifts', () => {
    const schedules = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 3), shiftType: ShiftType.OFF },
    ]

    const levels = calculateStaffingLevels(
      schedules,
      createDate(2025, 1, 1),
      createDate(2025, 1, 3)
    )

    expect(levels).toHaveLength(3)
    expect(levels[0]).toEqual({
      date: expect.any(Date),
      dayShift: 1,
      nightShift: 0,
      total: 1,
    })
    expect(levels[1]).toEqual({
      date: expect.any(Date),
      dayShift: 1,
      nightShift: 0,
      total: 1,
    })
    expect(levels[2]).toEqual({
      date: expect.any(Date),
      dayShift: 0,
      nightShift: 0,
      total: 0,
    })
  })

  it('calculates correct staffing for multiple workers', () => {
    const schedules = [
      // Worker 1
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.NIGHT },
      // Worker 2
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
      // Worker 3
      { date: createDate(2025, 1, 1), shiftType: ShiftType.NIGHT },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.OFF },
    ]

    const levels = calculateStaffingLevels(
      schedules,
      createDate(2025, 1, 1),
      createDate(2025, 1, 2)
    )

    expect(levels).toHaveLength(2)

    // Day 1: 2 day shifts, 1 night shift
    expect(levels[0].dayShift).toBe(2)
    expect(levels[0].nightShift).toBe(1)
    expect(levels[0].total).toBe(3)

    // Day 2: 1 day shift, 1 night shift
    expect(levels[1].dayShift).toBe(1)
    expect(levels[1].nightShift).toBe(1)
    expect(levels[1].total).toBe(2)
  })

  it('handles empty schedule array', () => {
    const levels = calculateStaffingLevels(
      [],
      createDate(2025, 1, 1),
      createDate(2025, 1, 3)
    )

    expect(levels).toHaveLength(3)
    levels.forEach(level => {
      expect(level.dayShift).toBe(0)
      expect(level.nightShift).toBe(0)
      expect(level.total).toBe(0)
    })
  })

  it('ignores OFF, VACATION, SICK shifts in total count', () => {
    const schedules = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 1), shiftType: ShiftType.OFF },
      { date: createDate(2025, 1, 1), shiftType: ShiftType.VACATION },
      { date: createDate(2025, 1, 1), shiftType: ShiftType.SICK },
      { date: createDate(2025, 1, 1), shiftType: ShiftType.TRAINING },
      { date: createDate(2025, 1, 1), shiftType: ShiftType.SHUTDOWN },
    ]

    const levels = calculateStaffingLevels(
      schedules,
      createDate(2025, 1, 1),
      createDate(2025, 1, 1)
    )

    expect(levels).toHaveLength(1)
    expect(levels[0].dayShift).toBe(1)
    expect(levels[0].nightShift).toBe(0)
    expect(levels[0].total).toBe(1)
  })
})

describe('findStaffingGaps', () => {
  it('returns empty array when staffing meets requirements', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 5, nightShift: 3, total: 8 },
      { date: createDate(2025, 1, 2), dayShift: 5, nightShift: 3, total: 8 },
    ]

    const gaps = findStaffingGaps(levels, 3, 2)

    expect(gaps).toHaveLength(0)
  })

  it('detects day shift shortage', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 2, nightShift: 3, total: 5 },
    ]

    const gaps = findStaffingGaps(levels, 5, 2)

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toEqual({
      date: expect.any(Date),
      shiftType: 'DAY',
      required: 5,
      actual: 2,
      shortage: 3,
    })
  })

  it('detects night shift shortage', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 5, nightShift: 1, total: 6 },
    ]

    const gaps = findStaffingGaps(levels, 3, 3)

    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toEqual({
      date: expect.any(Date),
      shiftType: 'NIGHT',
      required: 3,
      actual: 1,
      shortage: 2,
    })
  })

  it('detects both day and night shortages on same day', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 2, nightShift: 1, total: 3 },
    ]

    const gaps = findStaffingGaps(levels, 4, 3)

    expect(gaps).toHaveLength(2)

    const dayGap = gaps.find(g => g.shiftType === 'DAY')
    const nightGap = gaps.find(g => g.shiftType === 'NIGHT')

    expect(dayGap).toBeDefined()
    expect(dayGap?.shortage).toBe(2)

    expect(nightGap).toBeDefined()
    expect(nightGap?.shortage).toBe(2)
  })

  it('detects gaps across multiple days', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 5, nightShift: 3, total: 8 }, // OK
      { date: createDate(2025, 1, 2), dayShift: 2, nightShift: 3, total: 5 }, // Day gap
      { date: createDate(2025, 1, 3), dayShift: 5, nightShift: 3, total: 8 }, // OK
      { date: createDate(2025, 1, 4), dayShift: 5, nightShift: 1, total: 6 }, // Night gap
    ]

    const gaps = findStaffingGaps(levels, 4, 2)

    expect(gaps).toHaveLength(2)
    expect(gaps[0].date.getDate()).toBe(2)
    expect(gaps[0].shiftType).toBe('DAY')
    expect(gaps[1].date.getDate()).toBe(4)
    expect(gaps[1].shiftType).toBe('NIGHT')
  })

  it('handles zero staffing requirements', () => {
    const levels: StaffingLevel[] = [
      { date: createDate(2025, 1, 1), dayShift: 0, nightShift: 0, total: 0 },
    ]

    const gaps = findStaffingGaps(levels, 0, 0)

    expect(gaps).toHaveLength(0)
  })

  it('handles empty levels array', () => {
    const gaps = findStaffingGaps([], 5, 3)

    expect(gaps).toHaveLength(0)
  })
})

describe('calculateOnboardingSync', () => {
  it('returns same date when crew is at phase 0', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 15)

    const result = calculateOnboardingSync(0, pattern, targetStartDate)

    expect(result.syncedStartDate.getDate()).toBe(15)
    expect(result.adjustmentDays).toBe(0)
  })

  it('adjusts date to next cycle start when crew is mid-cycle', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 15)

    // Crew is at phase 2 (last working day)
    const result = calculateOnboardingSync(2, pattern, targetStartDate)

    // Need to wait 4 days to get to next phase 0
    // Phase 2 -> 3 -> 4 -> 5 -> 0 (4 days)
    expect(result.adjustmentDays).toBe(4)
    expect(result.syncedStartDate.getDate()).toBe(19)
  })

  it('adjusts date when crew is in off days', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 15)

    // Crew is at phase 4 (second off day)
    const result = calculateOnboardingSync(4, pattern, targetStartDate)

    // Need to wait 2 days to get to next phase 0
    expect(result.adjustmentDays).toBe(2)
    expect(result.syncedStartDate.getDate()).toBe(17)
  })

  it('handles phase at last off day (phase 5 in 3on3off)', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 15)

    // Crew is at phase 5 (last off day, next day is cycle start)
    const result = calculateOnboardingSync(5, pattern, targetStartDate)

    expect(result.adjustmentDays).toBe(1)
    expect(result.syncedStartDate.getDate()).toBe(16)
  })

  it('works with longer rotation patterns (14on14off)', () => {
    const pattern: RotationPattern = {
      daysOn: 14,
      daysOff: 14,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 1)

    // Crew is at phase 7 (middle of working days)
    const result = calculateOnboardingSync(7, pattern, targetStartDate)

    // Need to wait 21 days to get to next phase 0
    expect(result.adjustmentDays).toBe(21)
  })

  it('handles month boundary when adjusting', () => {
    const pattern: RotationPattern = {
      daysOn: 3,
      daysOff: 3,
      includesNights: false,
      nightsAtStart: false,
      nightDays: 0,
    }

    const targetStartDate = createDate(2025, 1, 30) // Jan 30

    const result = calculateOnboardingSync(3, pattern, targetStartDate)

    expect(result.adjustmentDays).toBe(3)
    expect(result.syncedStartDate.getMonth()).toBe(1) // February
    expect(result.syncedStartDate.getDate()).toBe(2) // Feb 2
  })
})

describe('applyShutdown', () => {
  it('converts shifts within shutdown period to SHUTDOWN type', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 3), shiftType: ShiftType.NIGHT },
      { date: createDate(2025, 1, 4), shiftType: ShiftType.OFF },
      { date: createDate(2025, 1, 5), shiftType: ShiftType.DAY },
    ]

    const shutdownStart = createDate(2025, 1, 2)
    const shutdownEnd = createDate(2025, 1, 4)

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    expect(result).toHaveLength(5)
    expect(result[0].shiftType).toBe(ShiftType.DAY) // Before shutdown
    expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN) // In shutdown
    expect(result[2].shiftType).toBe(ShiftType.SHUTDOWN) // In shutdown
    expect(result[3].shiftType).toBe(ShiftType.SHUTDOWN) // In shutdown
    expect(result[4].shiftType).toBe(ShiftType.DAY) // After shutdown
  })

  it('does not modify original schedule array', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
    ]

    const shutdownStart = createDate(2025, 1, 1)
    const shutdownEnd = createDate(2025, 1, 2)

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    // Original should be unchanged
    expect(schedules[0].shiftType).toBe(ShiftType.DAY)
    expect(schedules[1].shiftType).toBe(ShiftType.DAY)

    // Result should have shutdown
    expect(result[0].shiftType).toBe(ShiftType.SHUTDOWN)
    expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN)
  })

  it('converts all shift types to SHUTDOWN (including OFF, NIGHT)', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.NIGHT },
      { date: createDate(2025, 1, 3), shiftType: ShiftType.OFF },
      { date: createDate(2025, 1, 4), shiftType: ShiftType.VACATION },
    ]

    const shutdownStart = createDate(2025, 1, 1)
    const shutdownEnd = createDate(2025, 1, 4)

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    expect(result.every(s => s.shiftType === ShiftType.SHUTDOWN)).toBe(true)
  })

  it('handles single day shutdown', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY },
    ]

    const shutdownDate = createDate(2025, 1, 2)

    const result = applyShutdown(schedules, shutdownDate, shutdownDate)

    expect(result[0].shiftType).toBe(ShiftType.DAY)
    expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN)
    expect(result[2].shiftType).toBe(ShiftType.DAY)
  })

  it('returns unchanged schedules when shutdown period does not overlap', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
    ]

    const shutdownStart = createDate(2025, 1, 10)
    const shutdownEnd = createDate(2025, 1, 15)

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    expect(getShiftTypes(result)).toEqual([ShiftType.DAY, ShiftType.DAY])
  })

  it('handles empty schedule array', () => {
    const result = applyShutdown([], createDate(2025, 1, 1), createDate(2025, 1, 5))

    expect(result).toHaveLength(0)
  })

  it('handles partial overlap at start', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 4), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 5), shiftType: ShiftType.DAY },
    ]

    const shutdownStart = createDate(2025, 1, 1) // Before schedule starts
    const shutdownEnd = createDate(2025, 1, 4)

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    expect(result[0].shiftType).toBe(ShiftType.SHUTDOWN) // Jan 3
    expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN) // Jan 4
    expect(result[2].shiftType).toBe(ShiftType.DAY) // Jan 5
  })

  it('handles partial overlap at end', () => {
    const schedules: GeneratedSchedule[] = [
      { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
      { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY },
    ]

    const shutdownStart = createDate(2025, 1, 2)
    const shutdownEnd = createDate(2025, 1, 10) // After schedule ends

    const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

    expect(result[0].shiftType).toBe(ShiftType.DAY) // Jan 1
    expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN) // Jan 2
    expect(result[2].shiftType).toBe(ShiftType.SHUTDOWN) // Jan 3
  })
})

describe('standardPatterns', () => {
  it('contains expected pattern keys', () => {
    expect(Object.keys(standardPatterns)).toEqual([
      '3on3off',
      '3on3off-nights',
      '2on2off',
      '2on2off-nights',
      '7on7off',
      '14on14off',
      '14on14off-nights',
      '21on21off',
    ])
  })

  it('has valid configuration for 3on3off', () => {
    const pattern = standardPatterns['3on3off']
    expect(pattern.daysOn).toBe(3)
    expect(pattern.daysOff).toBe(3)
    expect(pattern.includesNights).toBe(false)
  })

  it('has valid configuration for 3on3off-nights', () => {
    const pattern = standardPatterns['3on3off-nights']
    expect(pattern.daysOn).toBe(3)
    expect(pattern.daysOff).toBe(3)
    expect(pattern.includesNights).toBe(true)
    expect(pattern.nightsAtStart).toBe(true)
    expect(pattern.nightDays).toBe(2)
  })

  it('has valid configuration for 14on14off-nights', () => {
    const pattern = standardPatterns['14on14off-nights']
    expect(pattern.daysOn).toBe(14)
    expect(pattern.daysOff).toBe(14)
    expect(pattern.includesNights).toBe(true)
    expect(pattern.nightsAtStart).toBe(true)
    expect(pattern.nightDays).toBe(7)
  })

  it('all patterns have nightDays <= daysOn', () => {
    Object.values(standardPatterns).forEach(pattern => {
      expect(pattern.nightDays).toBeLessThanOrEqual(pattern.daysOn)
    })
  })

  it('all patterns have positive daysOn and daysOff', () => {
    Object.values(standardPatterns).forEach(pattern => {
      expect(pattern.daysOn).toBeGreaterThan(0)
      expect(pattern.daysOff).toBeGreaterThan(0)
    })
  })
})

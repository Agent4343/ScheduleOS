import { describe, it, expect, beforeEach } from 'vitest'
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
} from '../scheduling'

// Helper function to create a date at midnight UTC
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

// Helper to extract shift types from a schedule
function getShiftTypes(schedules: GeneratedSchedule[]): string[] {
  return schedules.map(s => s.shiftType)
}

describe('scheduling', () => {
  describe('standardPatterns', () => {
    it('should have all expected patterns defined', () => {
      expect(standardPatterns).toHaveProperty('3on3off')
      expect(standardPatterns).toHaveProperty('3on3off-nights')
      expect(standardPatterns).toHaveProperty('2on2off')
      expect(standardPatterns).toHaveProperty('2on2off-nights')
      expect(standardPatterns).toHaveProperty('7on7off')
      expect(standardPatterns).toHaveProperty('14on14off')
      expect(standardPatterns).toHaveProperty('14on14off-nights')
      expect(standardPatterns).toHaveProperty('21on21off')
    })

    it('should have correct structure for 3on3off pattern', () => {
      const pattern = standardPatterns['3on3off']
      expect(pattern.daysOn).toBe(3)
      expect(pattern.daysOff).toBe(3)
      expect(pattern.includesNights).toBe(false)
    })

    it('should have correct structure for 3on3off-nights pattern', () => {
      const pattern = standardPatterns['3on3off-nights']
      expect(pattern.daysOn).toBe(3)
      expect(pattern.daysOff).toBe(3)
      expect(pattern.includesNights).toBe(true)
      expect(pattern.nightsAtStart).toBe(true)
      expect(pattern.nightDays).toBe(2)
    })
  })

  describe('generateRotationSchedule', () => {
    describe('basic day-only patterns', () => {
      it('should generate a simple 3on3off pattern', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 12)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(12)

        // First 3 days should be DAY
        expect(schedules[0].shiftType).toBe(ShiftType.DAY)
        expect(schedules[1].shiftType).toBe(ShiftType.DAY)
        expect(schedules[2].shiftType).toBe(ShiftType.DAY)

        // Next 3 days should be OFF
        expect(schedules[3].shiftType).toBe(ShiftType.OFF)
        expect(schedules[4].shiftType).toBe(ShiftType.OFF)
        expect(schedules[5].shiftType).toBe(ShiftType.OFF)

        // Next 3 days should be DAY again
        expect(schedules[6].shiftType).toBe(ShiftType.DAY)
        expect(schedules[7].shiftType).toBe(ShiftType.DAY)
        expect(schedules[8].shiftType).toBe(ShiftType.DAY)

        // Last 3 days should be OFF
        expect(schedules[9].shiftType).toBe(ShiftType.OFF)
        expect(schedules[10].shiftType).toBe(ShiftType.OFF)
        expect(schedules[11].shiftType).toBe(ShiftType.OFF)
      })

      it('should generate a 2on2off pattern', () => {
        const pattern = standardPatterns['2on2off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 8)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(8)
        const types = getShiftTypes(schedules)
        expect(types).toEqual([
          'DAY', 'DAY', 'OFF', 'OFF',
          'DAY', 'DAY', 'OFF', 'OFF'
        ])
      })

      it('should generate a 7on7off pattern', () => {
        const pattern = standardPatterns['7on7off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 14)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(14)

        // First 7 days should be DAY
        for (let i = 0; i < 7; i++) {
          expect(schedules[i].shiftType).toBe(ShiftType.DAY)
        }

        // Next 7 days should be OFF
        for (let i = 7; i < 14; i++) {
          expect(schedules[i].shiftType).toBe(ShiftType.OFF)
        }
      })
    })

    describe('patterns with night shifts', () => {
      it('should alternate rotations between day and night when includesNights is true', () => {
        const pattern = standardPatterns['3on3off-nights']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 18) // 3 full rotations

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(18)

        // First rotation (days 1-3): DAY (since startOnNights defaults to false)
        expect(schedules[0].shiftType).toBe(ShiftType.DAY)
        expect(schedules[1].shiftType).toBe(ShiftType.DAY)
        expect(schedules[2].shiftType).toBe(ShiftType.DAY)

        // Days 4-6: OFF
        expect(schedules[3].shiftType).toBe(ShiftType.OFF)
        expect(schedules[4].shiftType).toBe(ShiftType.OFF)
        expect(schedules[5].shiftType).toBe(ShiftType.OFF)

        // Second rotation (days 7-9): NIGHT
        expect(schedules[6].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[7].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[8].shiftType).toBe(ShiftType.NIGHT)

        // Days 10-12: OFF
        expect(schedules[9].shiftType).toBe(ShiftType.OFF)
        expect(schedules[10].shiftType).toBe(ShiftType.OFF)
        expect(schedules[11].shiftType).toBe(ShiftType.OFF)

        // Third rotation (days 13-15): DAY again
        expect(schedules[12].shiftType).toBe(ShiftType.DAY)
        expect(schedules[13].shiftType).toBe(ShiftType.DAY)
        expect(schedules[14].shiftType).toBe(ShiftType.DAY)
      })

      it('should start on nights when startOnNights is true', () => {
        const pattern = standardPatterns['3on3off-nights']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 12)

        const schedules = generateRotationSchedule(pattern, startDate, endDate, 0, true)

        expect(schedules).toHaveLength(12)

        // First rotation should be NIGHT
        expect(schedules[0].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[1].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[2].shiftType).toBe(ShiftType.NIGHT)

        // OFF days
        expect(schedules[3].shiftType).toBe(ShiftType.OFF)

        // Second rotation should be DAY
        expect(schedules[6].shiftType).toBe(ShiftType.DAY)
        expect(schedules[7].shiftType).toBe(ShiftType.DAY)
        expect(schedules[8].shiftType).toBe(ShiftType.DAY)
      })

      it('should handle 2on2off with nights correctly', () => {
        const pattern = standardPatterns['2on2off-nights']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 16) // 4 rotations

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(16)

        // First rotation: DAY, DAY
        expect(schedules[0].shiftType).toBe(ShiftType.DAY)
        expect(schedules[1].shiftType).toBe(ShiftType.DAY)
        expect(schedules[2].shiftType).toBe(ShiftType.OFF)
        expect(schedules[3].shiftType).toBe(ShiftType.OFF)

        // Second rotation: NIGHT, NIGHT
        expect(schedules[4].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[5].shiftType).toBe(ShiftType.NIGHT)
        expect(schedules[6].shiftType).toBe(ShiftType.OFF)
        expect(schedules[7].shiftType).toBe(ShiftType.OFF)

        // Third rotation: DAY, DAY
        expect(schedules[8].shiftType).toBe(ShiftType.DAY)
        expect(schedules[9].shiftType).toBe(ShiftType.DAY)
      })
    })

    describe('phase offset handling', () => {
      it('should start at the correct phase when startPhase is provided', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 6)

        // Start at phase 2 (last day of work cycle)
        const schedules = generateRotationSchedule(pattern, startDate, endDate, 2)

        expect(schedules).toHaveLength(6)

        // Phase 2 = last work day, then 3 off, then 2 work days
        expect(schedules[0].shiftType).toBe(ShiftType.DAY)
        expect(schedules[1].shiftType).toBe(ShiftType.OFF)
        expect(schedules[2].shiftType).toBe(ShiftType.OFF)
        expect(schedules[3].shiftType).toBe(ShiftType.OFF)
        expect(schedules[4].shiftType).toBe(ShiftType.DAY)
        expect(schedules[5].shiftType).toBe(ShiftType.DAY)
      })

      it('should start on off days when phase is in off portion', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 6)

        // Start at phase 4 (second off day)
        const schedules = generateRotationSchedule(pattern, startDate, endDate, 4)

        expect(schedules).toHaveLength(6)
        expect(schedules[0].shiftType).toBe(ShiftType.OFF)
        expect(schedules[1].shiftType).toBe(ShiftType.OFF)
        expect(schedules[2].shiftType).toBe(ShiftType.DAY)
        expect(schedules[3].shiftType).toBe(ShiftType.DAY)
        expect(schedules[4].shiftType).toBe(ShiftType.DAY)
        expect(schedules[5].shiftType).toBe(ShiftType.OFF)
      })

      it('should handle phase offset larger than cycle length', () => {
        const pattern = standardPatterns['3on3off'] // cycle = 6
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 6)

        // Start at phase 8 (should be equivalent to phase 2)
        const schedules8 = generateRotationSchedule(pattern, startDate, endDate, 8)
        const schedules2 = generateRotationSchedule(pattern, startDate, endDate, 2)

        expect(getShiftTypes(schedules8)).toEqual(getShiftTypes(schedules2))
      })
    })

    describe('date handling', () => {
      it('should generate correct dates for each schedule', () => {
        const pattern = standardPatterns['2on2off']
        const startDate = createDate(2025, 1, 15)
        const endDate = createDate(2025, 1, 18)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(4)
        expect(schedules[0].date.getDate()).toBe(15)
        expect(schedules[1].date.getDate()).toBe(16)
        expect(schedules[2].date.getDate()).toBe(17)
        expect(schedules[3].date.getDate()).toBe(18)
      })

      it('should handle month boundaries', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 30)
        const endDate = createDate(2025, 2, 2)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(4)
        expect(schedules[0].date.getMonth()).toBe(0) // January
        expect(schedules[1].date.getMonth()).toBe(0) // January
        expect(schedules[2].date.getMonth()).toBe(1) // February
        expect(schedules[3].date.getMonth()).toBe(1) // February
      })

      it('should handle year boundaries', () => {
        const pattern = standardPatterns['2on2off']
        const startDate = createDate(2024, 12, 30)
        const endDate = createDate(2025, 1, 2)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(4)
        expect(schedules[0].date.getFullYear()).toBe(2024)
        expect(schedules[1].date.getFullYear()).toBe(2024)
        expect(schedules[2].date.getFullYear()).toBe(2025)
        expect(schedules[3].date.getFullYear()).toBe(2025)
      })

      it('should return empty array when start date is after end date', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 10)
        const endDate = createDate(2025, 1, 5)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(0)
      })

      it('should return single day when start equals end', () => {
        const pattern = standardPatterns['3on3off']
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 1)

        const schedules = generateRotationSchedule(pattern, startDate, endDate)

        expect(schedules).toHaveLength(1)
        expect(schedules[0].shiftType).toBe(ShiftType.DAY)
      })
    })

    describe('custom patterns', () => {
      it('should work with custom rotation patterns', () => {
        const customPattern: RotationPattern = {
          daysOn: 5,
          daysOff: 2,
          includesNights: false,
          nightsAtStart: false,
          nightDays: 0,
        }
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 14)

        const schedules = generateRotationSchedule(customPattern, startDate, endDate)

        expect(schedules).toHaveLength(14)

        // 5 on, 2 off, 5 on, 2 off
        const types = getShiftTypes(schedules)
        expect(types.slice(0, 5).every(t => t === 'DAY')).toBe(true)
        expect(types.slice(5, 7).every(t => t === 'OFF')).toBe(true)
        expect(types.slice(7, 12).every(t => t === 'DAY')).toBe(true)
        expect(types.slice(12, 14).every(t => t === 'OFF')).toBe(true)
      })

      it('should work with a 1on1off pattern', () => {
        const customPattern: RotationPattern = {
          daysOn: 1,
          daysOff: 1,
          includesNights: false,
          nightsAtStart: false,
          nightDays: 0,
        }
        const startDate = createDate(2025, 1, 1)
        const endDate = createDate(2025, 1, 6)

        const schedules = generateRotationSchedule(customPattern, startDate, endDate)

        expect(schedules).toHaveLength(6)
        const types = getShiftTypes(schedules)
        expect(types).toEqual(['DAY', 'OFF', 'DAY', 'OFF', 'DAY', 'OFF'])
      })
    })
  })

  describe('calculateCurrentPhase', () => {
    it('should return 0 for the rotation start date', () => {
      const pattern = standardPatterns['3on3off']
      const rotationStart = createDate(2025, 1, 1)
      const targetDate = createDate(2025, 1, 1)

      const phase = calculateCurrentPhase(rotationStart, targetDate, pattern)

      expect(phase).toBe(0)
    })

    it('should correctly calculate phase within first rotation', () => {
      const pattern = standardPatterns['3on3off']
      const rotationStart = createDate(2025, 1, 1)

      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 2), pattern)).toBe(1)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 3), pattern)).toBe(2)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 4), pattern)).toBe(3)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 5), pattern)).toBe(4)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 6), pattern)).toBe(5)
    })

    it('should wrap around to 0 after a full cycle', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6
      const rotationStart = createDate(2025, 1, 1)

      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 7), pattern)).toBe(0)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 8), pattern)).toBe(1)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 13), pattern)).toBe(0)
    })

    it('should work with larger cycles', () => {
      const pattern = standardPatterns['14on14off'] // cycle = 28
      const rotationStart = createDate(2025, 1, 1)

      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 15), pattern)).toBe(14)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 28), pattern)).toBe(27)
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 29), pattern)).toBe(0)
    })

    it('should handle dates before the rotation start (negative offset)', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6
      const rotationStart = createDate(2025, 1, 10)

      // 3 days before = phase should be 3 (since -3 mod 6 + 6 = 3)
      const phase = calculateCurrentPhase(rotationStart, createDate(2025, 1, 7), pattern)
      expect(phase).toBe(3)
    })

    it('should handle negative offset correctly for various cases', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6
      const rotationStart = createDate(2025, 1, 10)

      // 1 day before: -1 mod 6 + 6 = 5
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 9), pattern)).toBe(5)

      // 6 days before: -6 mod 6 + 6 = 0
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 4), pattern)).toBe(0)

      // 7 days before: -7 mod 6 + 6 = 5
      expect(calculateCurrentPhase(rotationStart, createDate(2025, 1, 3), pattern)).toBe(5)
    })

    it('should handle long time periods', () => {
      const pattern = standardPatterns['7on7off'] // cycle = 14
      const rotationStart = createDate(2020, 1, 1)
      const targetDate = createDate(2025, 6, 15)

      const phase = calculateCurrentPhase(rotationStart, targetDate, pattern)

      expect(phase).toBeGreaterThanOrEqual(0)
      expect(phase).toBeLessThan(14)
    })
  })

  describe('getCrewPhaseOffset', () => {
    it('should return 0 for crew index 0', () => {
      const pattern = standardPatterns['3on3off']
      expect(getCrewPhaseOffset(0, pattern)).toBe(0)
    })

    it('should calculate correct offset for 3on3off pattern', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6

      // Crew 0: offset 0
      expect(getCrewPhaseOffset(0, pattern)).toBe(0)

      // Crew 1: floor(1 * 6 / 2) % 6 = 3
      expect(getCrewPhaseOffset(1, pattern)).toBe(3)

      // Crew 2: floor(2 * 6 / 2) % 6 = 0
      expect(getCrewPhaseOffset(2, pattern)).toBe(0)

      // Crew 3: floor(3 * 6 / 2) % 6 = 3
      expect(getCrewPhaseOffset(3, pattern)).toBe(3)
    })

    it('should calculate correct offset for 7on7off pattern', () => {
      const pattern = standardPatterns['7on7off'] // cycle = 14

      // Crew 0: 0
      expect(getCrewPhaseOffset(0, pattern)).toBe(0)

      // Crew 1: floor(1 * 14 / 2) % 14 = 7
      expect(getCrewPhaseOffset(1, pattern)).toBe(7)

      // Crew 2: floor(2 * 14 / 2) % 14 = 0
      expect(getCrewPhaseOffset(2, pattern)).toBe(0)

      // Crew 3: floor(3 * 14 / 2) % 14 = 7
      expect(getCrewPhaseOffset(3, pattern)).toBe(7)
    })

    it('should calculate correct offset for 14on14off pattern', () => {
      const pattern = standardPatterns['14on14off'] // cycle = 28

      expect(getCrewPhaseOffset(0, pattern)).toBe(0)
      expect(getCrewPhaseOffset(1, pattern)).toBe(14)
      expect(getCrewPhaseOffset(2, pattern)).toBe(0)
      expect(getCrewPhaseOffset(3, pattern)).toBe(14)
    })

    it('should ensure offsets create alternating coverage', () => {
      const pattern = standardPatterns['7on7off']

      const offset0 = getCrewPhaseOffset(0, pattern)
      const offset1 = getCrewPhaseOffset(1, pattern)

      // Offset should be exactly half the cycle apart for continuous coverage
      expect(Math.abs(offset1 - offset0)).toBe(7)
    })
  })

  describe('calculateStaffingLevels', () => {
    it('should calculate staffing for a simple day', () => {
      const schedules = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 1), shiftType: ShiftType.NIGHT },
      ]
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 1)

      const levels = calculateStaffingLevels(schedules, startDate, endDate)

      expect(levels).toHaveLength(1)
      expect(levels[0].dayShift).toBe(2)
      expect(levels[0].nightShift).toBe(1)
      expect(levels[0].total).toBe(3)
    })

    it('should calculate staffing over multiple days', () => {
      const schedules = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 1), shiftType: ShiftType.NIGHT },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 3), shiftType: ShiftType.NIGHT },
      ]
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 3)

      const levels = calculateStaffingLevels(schedules, startDate, endDate)

      expect(levels).toHaveLength(3)

      expect(levels[0].dayShift).toBe(1)
      expect(levels[0].nightShift).toBe(1)
      expect(levels[0].total).toBe(2)

      expect(levels[1].dayShift).toBe(2)
      expect(levels[1].nightShift).toBe(0)
      expect(levels[1].total).toBe(2)

      expect(levels[2].dayShift).toBe(0)
      expect(levels[2].nightShift).toBe(1)
      expect(levels[2].total).toBe(1)
    })

    it('should return 0 staffing for days with only OFF shifts', () => {
      const schedules = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.OFF },
        { date: createDate(2025, 1, 1), shiftType: ShiftType.OFF },
      ]
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 1)

      const levels = calculateStaffingLevels(schedules, startDate, endDate)

      expect(levels).toHaveLength(1)
      expect(levels[0].dayShift).toBe(0)
      expect(levels[0].nightShift).toBe(0)
      expect(levels[0].total).toBe(0)
    })

    it('should handle empty schedules', () => {
      const schedules: Array<{ date: Date; shiftType: typeof ShiftType[keyof typeof ShiftType] }> = []
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 3)

      const levels = calculateStaffingLevels(schedules, startDate, endDate)

      expect(levels).toHaveLength(3)
      expect(levels[0].dayShift).toBe(0)
      expect(levels[0].nightShift).toBe(0)
      expect(levels[0].total).toBe(0)
    })

    it('should handle schedules outside the date range', () => {
      const schedules = [
        { date: createDate(2024, 12, 31), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY },
        { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY },
      ]
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 2)

      const levels = calculateStaffingLevels(schedules, startDate, endDate)

      expect(levels).toHaveLength(2)
      expect(levels[0].dayShift).toBe(1) // Only Jan 1
      expect(levels[1].dayShift).toBe(0) // Jan 2 has no schedule (Jan 3 is outside)
    })
  })

  describe('findStaffingGaps', () => {
    it('should find no gaps when staffing meets requirements', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 5, nightShift: 3, total: 8 },
        { date: createDate(2025, 1, 2), dayShift: 5, nightShift: 3, total: 8 },
      ]

      const gaps = findStaffingGaps(levels, 5, 3)

      expect(gaps).toHaveLength(0)
    })

    it('should find day shift gaps', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 3, nightShift: 5, total: 8 },
        { date: createDate(2025, 1, 2), dayShift: 5, nightShift: 5, total: 10 },
      ]

      const gaps = findStaffingGaps(levels, 5, 3)

      expect(gaps).toHaveLength(1)
      expect(gaps[0].shiftType).toBe('DAY')
      expect(gaps[0].required).toBe(5)
      expect(gaps[0].actual).toBe(3)
      expect(gaps[0].shortage).toBe(2)
    })

    it('should find night shift gaps', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 5, nightShift: 2, total: 7 },
      ]

      const gaps = findStaffingGaps(levels, 5, 4)

      expect(gaps).toHaveLength(1)
      expect(gaps[0].shiftType).toBe('NIGHT')
      expect(gaps[0].required).toBe(4)
      expect(gaps[0].actual).toBe(2)
      expect(gaps[0].shortage).toBe(2)
    })

    it('should find both day and night gaps on the same day', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 2, nightShift: 1, total: 3 },
      ]

      const gaps = findStaffingGaps(levels, 5, 3)

      expect(gaps).toHaveLength(2)

      const dayGap = gaps.find(g => g.shiftType === 'DAY')
      const nightGap = gaps.find(g => g.shiftType === 'NIGHT')

      expect(dayGap).toBeDefined()
      expect(dayGap!.shortage).toBe(3)

      expect(nightGap).toBeDefined()
      expect(nightGap!.shortage).toBe(2)
    })

    it('should handle zero requirements', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 0, nightShift: 0, total: 0 },
      ]

      const gaps = findStaffingGaps(levels, 0, 0)

      expect(gaps).toHaveLength(0)
    })

    it('should find gaps across multiple days', () => {
      const levels: StaffingLevel[] = [
        { date: createDate(2025, 1, 1), dayShift: 4, nightShift: 3, total: 7 },
        { date: createDate(2025, 1, 2), dayShift: 5, nightShift: 2, total: 7 },
        { date: createDate(2025, 1, 3), dayShift: 3, nightShift: 1, total: 4 },
      ]

      const gaps = findStaffingGaps(levels, 5, 3)

      expect(gaps).toHaveLength(4)

      // Day 1: day gap (4 < 5)
      // Day 2: night gap (2 < 3)
      // Day 3: day gap (3 < 5) and night gap (1 < 3)
    })

    it('should handle empty levels array', () => {
      const gaps = findStaffingGaps([], 5, 3)
      expect(gaps).toHaveLength(0)
    })
  })

  describe('calculateOnboardingSync', () => {
    it('should return same date when crew is at phase 0', () => {
      const pattern = standardPatterns['3on3off']
      const targetDate = createDate(2025, 1, 1)

      const result = calculateOnboardingSync(0, pattern, targetDate)

      expect(result.syncedStartDate.getTime()).toBe(targetDate.getTime())
      expect(result.adjustmentDays).toBe(0)
    })

    it('should calculate adjustment when crew is mid-cycle', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6
      const targetDate = createDate(2025, 1, 1)

      // Crew at phase 2 means 4 days until next cycle start (6 - 2)
      const result = calculateOnboardingSync(2, pattern, targetDate)

      expect(result.adjustmentDays).toBe(4)
      expect(result.syncedStartDate.getDate()).toBe(5) // Jan 1 + 4 = Jan 5
    })

    it('should handle crew at end of cycle', () => {
      const pattern = standardPatterns['3on3off'] // cycle = 6
      const targetDate = createDate(2025, 1, 1)

      // Crew at phase 5 means 1 day until next cycle start
      const result = calculateOnboardingSync(5, pattern, targetDate)

      expect(result.adjustmentDays).toBe(1)
      expect(result.syncedStartDate.getDate()).toBe(2)
    })

    it('should work with different patterns', () => {
      const pattern = standardPatterns['7on7off'] // cycle = 14
      const targetDate = createDate(2025, 1, 1)

      // Crew at phase 7 (first day of off period)
      const result = calculateOnboardingSync(7, pattern, targetDate)

      expect(result.adjustmentDays).toBe(7)
    })

    it('should handle month boundaries', () => {
      const pattern = standardPatterns['3on3off']
      const targetDate = createDate(2025, 1, 30)

      const result = calculateOnboardingSync(3, pattern, targetDate)

      // 3 days adjustment should cross into February
      expect(result.adjustmentDays).toBe(3)
      expect(result.syncedStartDate.getMonth()).toBe(1) // February
      expect(result.syncedStartDate.getDate()).toBe(2)
    })
  })

  describe('applyShutdown', () => {
    it('should change shift types within shutdown period to SHUTDOWN', () => {
      const schedules: GeneratedSchedule[] = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 4), shiftType: ShiftType.OFF as any },
      ]
      const shutdownStart = createDate(2025, 1, 2)
      const shutdownEnd = createDate(2025, 1, 3)

      const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

      expect(result[0].shiftType).toBe(ShiftType.DAY)
      expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN)
      expect(result[2].shiftType).toBe(ShiftType.SHUTDOWN)
      expect(result[3].shiftType).toBe(ShiftType.OFF)
    })

    it('should not modify schedules outside shutdown period', () => {
      const schedules: GeneratedSchedule[] = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 10), shiftType: ShiftType.NIGHT as any },
      ]
      const shutdownStart = createDate(2025, 1, 3)
      const shutdownEnd = createDate(2025, 1, 5)

      const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

      expect(result[0].shiftType).toBe(ShiftType.DAY)
      expect(result[1].shiftType).toBe(ShiftType.NIGHT)
    })

    it('should handle single-day shutdown', () => {
      const schedules: GeneratedSchedule[] = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 3), shiftType: ShiftType.DAY as any },
      ]
      const shutdownStart = createDate(2025, 1, 2)
      const shutdownEnd = createDate(2025, 1, 2)

      const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

      expect(result[0].shiftType).toBe(ShiftType.DAY)
      expect(result[1].shiftType).toBe(ShiftType.SHUTDOWN)
      expect(result[2].shiftType).toBe(ShiftType.DAY)
    })

    it('should not mutate original schedules', () => {
      const schedules: GeneratedSchedule[] = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.DAY as any },
      ]
      const shutdownStart = createDate(2025, 1, 2)
      const shutdownEnd = createDate(2025, 1, 2)

      applyShutdown(schedules, shutdownStart, shutdownEnd)

      expect(schedules[1].shiftType).toBe(ShiftType.DAY)
    })

    it('should handle empty schedules array', () => {
      const result = applyShutdown([], createDate(2025, 1, 1), createDate(2025, 1, 5))
      expect(result).toHaveLength(0)
    })

    it('should apply shutdown to all shift types', () => {
      const schedules: GeneratedSchedule[] = [
        { date: createDate(2025, 1, 1), shiftType: ShiftType.DAY as any },
        { date: createDate(2025, 1, 2), shiftType: ShiftType.NIGHT as any },
        { date: createDate(2025, 1, 3), shiftType: ShiftType.OFF as any },
      ]
      const shutdownStart = createDate(2025, 1, 1)
      const shutdownEnd = createDate(2025, 1, 3)

      const result = applyShutdown(schedules, shutdownStart, shutdownEnd)

      expect(result.every(s => s.shiftType === ShiftType.SHUTDOWN)).toBe(true)
    })
  })

  describe('integration tests', () => {
    it('should generate schedules for multiple crews with proper coverage', () => {
      const pattern = standardPatterns['7on7off']
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 14)

      // Generate schedules for two crews with offset
      const crew0Offset = getCrewPhaseOffset(0, pattern)
      const crew1Offset = getCrewPhaseOffset(1, pattern)

      const crew0Schedule = generateRotationSchedule(pattern, startDate, endDate, crew0Offset)
      const crew1Schedule = generateRotationSchedule(pattern, startDate, endDate, crew1Offset)

      // Combine all schedules
      const allSchedules = [...crew0Schedule, ...crew1Schedule]

      // Calculate staffing levels
      const levels = calculateStaffingLevels(allSchedules, startDate, endDate)

      // With 7on7off and 2 crews offset by half cycle, we should have
      // one crew on DAY every day
      for (const level of levels) {
        expect(level.total).toBeGreaterThanOrEqual(1)
      }
    })

    it('should correctly apply shutdown to generated schedules', () => {
      const pattern = standardPatterns['3on3off']
      const startDate = createDate(2025, 1, 1)
      const endDate = createDate(2025, 1, 12)
      const shutdownStart = createDate(2025, 1, 5)
      const shutdownEnd = createDate(2025, 1, 7)

      const schedules = generateRotationSchedule(pattern, startDate, endDate)
      const withShutdown = applyShutdown(schedules, shutdownStart, shutdownEnd)

      // Count SHUTDOWN days
      const shutdownDays = withShutdown.filter(s => s.shiftType === ShiftType.SHUTDOWN)
      expect(shutdownDays).toHaveLength(3)

      // Verify correct dates
      expect(shutdownDays[0].date.getDate()).toBe(5)
      expect(shutdownDays[1].date.getDate()).toBe(6)
      expect(shutdownDays[2].date.getDate()).toBe(7)
    })

    it('should calculate phase and generate matching schedule', () => {
      const pattern = standardPatterns['3on3off']
      const rotationStart = createDate(2025, 1, 1)
      const checkDate = createDate(2025, 1, 4) // Day 4

      const phase = calculateCurrentPhase(rotationStart, checkDate, pattern)

      // Phase 3 means first day off (0,1,2 = work, 3,4,5 = off)
      expect(phase).toBe(3)

      // Generate schedule starting at that phase
      const schedules = generateRotationSchedule(pattern, checkDate, checkDate, phase)

      expect(schedules[0].shiftType).toBe(ShiftType.OFF)
    })
  })
})

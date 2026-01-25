import { describe, it, expect } from 'vitest'
import { generateRotationSchedule, RotationPattern } from '../scheduling'
import { ShiftType } from '@prisma/client'

describe('generateRotationSchedule', () => {
  const pattern2on2off: RotationPattern = {
    daysOn: 2,
    daysOff: 2,
    includesNights: false,
    nightsAtStart: false,
    nightDays: 0,
  }

  const pattern3on3offNights: RotationPattern = {
    daysOn: 3,
    daysOff: 3,
    includesNights: true,
    nightsAtStart: true,
    nightDays: 2,
  }

  it('should generate correct schedule for 2on2off pattern', () => {
    const startDate = new Date('2024-01-01T00:00:00Z') // Monday
    const endDate = new Date('2024-01-10T00:00:00Z')
    
    const schedules = generateRotationSchedule(
      pattern2on2off,
      startDate,
      endDate
    )

    // Expected pattern: ON, ON, OFF, OFF, ON, ON, OFF, OFF, ON, ON
    expect(schedules).toHaveLength(10)
    expect(schedules[0].shiftType).toBe(ShiftType.DAY)
    expect(schedules[1].shiftType).toBe(ShiftType.DAY)
    expect(schedules[2].shiftType).toBe(ShiftType.OFF)
    expect(schedules[3].shiftType).toBe(ShiftType.OFF)
    expect(schedules[4].shiftType).toBe(ShiftType.DAY)
  })

  it('should handle startPhase correctly', () => {
    const startDate = new Date('2024-01-01T00:00:00Z')
    const endDate = new Date('2024-01-04T00:00:00Z')
    
    // Start at phase 2 (first day of OFF in 2on2off)
    const schedules = generateRotationSchedule(
      pattern2on2off,
      startDate,
      endDate,
      2
    )

    expect(schedules[0].shiftType).toBe(ShiftType.OFF)
    expect(schedules[1].shiftType).toBe(ShiftType.OFF)
    expect(schedules[2].shiftType).toBe(ShiftType.DAY)
    expect(schedules[3].shiftType).toBe(ShiftType.DAY)
  })

  it('should generate correct schedule for night shifts', () => {
    const startDate = new Date('2024-01-01T00:00:00Z')
    const endDate = new Date('2024-01-06T00:00:00Z')
    
    // Pattern: 3 days on (2 nights, 1 day), 3 days off
    const schedules = generateRotationSchedule(
      pattern3on3offNights,
      startDate,
      endDate
    )

    // Expected: NIGHT, NIGHT, DAY, OFF, OFF, OFF
    expect(schedules[0].shiftType).toBe(ShiftType.NIGHT)
    expect(schedules[1].shiftType).toBe(ShiftType.NIGHT)
    expect(schedules[2].shiftType).toBe(ShiftType.DAY)
    expect(schedules[3].shiftType).toBe(ShiftType.OFF)
    expect(schedules[4].shiftType).toBe(ShiftType.OFF)
    expect(schedules[5].shiftType).toBe(ShiftType.OFF)
  })

  it('should handle alternating shifts', () => {
    const alternatingPattern: RotationPattern = {
      daysOn: 2,
      daysOff: 2,
      includesNights: true,
      nightsAtStart: false,
      nightDays: 0,
      alternatesShifts: true
    }

    const startDate = new Date('2024-01-01T00:00:00Z')
    const endDate = new Date('2024-01-10T00:00:00Z')

    const schedules = generateRotationSchedule(
      alternatingPattern,
      startDate,
      endDate,
      0,
      'DAY'
    )

    // Cycle 1: DAY, DAY, OFF, OFF
    expect(schedules[0].shiftType).toBe(ShiftType.DAY)
    expect(schedules[1].shiftType).toBe(ShiftType.DAY)
    expect(schedules[2].shiftType).toBe(ShiftType.OFF)
    expect(schedules[3].shiftType).toBe(ShiftType.OFF)
    
    // Cycle 2: NIGHT, NIGHT, OFF, OFF
    expect(schedules[4].shiftType).toBe(ShiftType.NIGHT)
    expect(schedules[5].shiftType).toBe(ShiftType.NIGHT)
    expect(schedules[6].shiftType).toBe(ShiftType.OFF)
    expect(schedules[7].shiftType).toBe(ShiftType.OFF)

    // Cycle 3: DAY, DAY...
    expect(schedules[8].shiftType).toBe(ShiftType.DAY)
    expect(schedules[9].shiftType).toBe(ShiftType.DAY)
  })
})

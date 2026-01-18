import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDate,
  formatDateShort,
  getDateRange,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  generateSlug,
  generateToken,
} from './utils'

// Helper to create dates consistently
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

describe('cn (class name merger)', () => {
  it('merges multiple class names', () => {
    const result = cn('foo', 'bar', 'baz')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
    expect(result).toContain('baz')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    const result = cn('base', isActive && 'active', isDisabled && 'disabled')
    expect(result).toContain('base')
    expect(result).toContain('active')
    expect(result).not.toContain('disabled')
  })

  it('merges tailwind classes correctly', () => {
    // tailwind-merge should deduplicate conflicting classes
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toContain('px-4')
    expect(result).toContain('py-1')
  })

  it('handles empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles undefined and null', () => {
    const result = cn('base', undefined, null, 'end')
    expect(result).toContain('base')
    expect(result).toContain('end')
  })
})

describe('formatDate', () => {
  it('formats Date object correctly', () => {
    const date = createDate(2025, 3, 15) // March 15, 2025
    const result = formatDate(date)
    expect(result).toContain('Mar')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })

  it('formats date string correctly', () => {
    const result = formatDate('2025-06-20')
    expect(result).toContain('Jun')
    expect(result).toContain('20')
    expect(result).toContain('2025')
  })

  it('includes weekday in output', () => {
    const date = createDate(2025, 1, 1) // Wednesday, Jan 1, 2025
    const result = formatDate(date)
    expect(result).toContain('Wed')
  })
})

describe('formatDateShort', () => {
  it('formats date with month and day only', () => {
    const date = createDate(2025, 12, 25)
    const result = formatDateShort(date)
    expect(result).toContain('Dec')
    expect(result).toContain('25')
    expect(result).not.toContain('2025')
  })

  it('handles date string input', () => {
    const result = formatDateShort('2025-07-04')
    expect(result).toContain('Jul')
    expect(result).toContain('4')
  })
})

describe('getDateRange', () => {
  it('returns array of dates between start and end (inclusive)', () => {
    const start = createDate(2025, 1, 1)
    const end = createDate(2025, 1, 5)
    const result = getDateRange(start, end)

    expect(result).toHaveLength(5)
    expect(result[0].getDate()).toBe(1)
    expect(result[4].getDate()).toBe(5)
  })

  it('returns single date when start equals end', () => {
    const date = createDate(2025, 6, 15)
    const result = getDateRange(date, date)

    expect(result).toHaveLength(1)
    expect(result[0].getDate()).toBe(15)
  })

  it('returns empty array when end is before start', () => {
    const start = createDate(2025, 1, 10)
    const end = createDate(2025, 1, 5)
    const result = getDateRange(start, end)

    expect(result).toHaveLength(0)
  })

  it('handles month boundary crossing', () => {
    const start = createDate(2025, 1, 30)
    const end = createDate(2025, 2, 2)
    const result = getDateRange(start, end)

    expect(result).toHaveLength(4)
    expect(result[0].getMonth()).toBe(0) // January
    expect(result[2].getMonth()).toBe(1) // February
  })

  it('handles year boundary crossing', () => {
    const start = createDate(2025, 12, 30)
    const end = createDate(2026, 1, 2)
    const result = getDateRange(start, end)

    expect(result).toHaveLength(4)
    expect(result[0].getFullYear()).toBe(2025)
    expect(result[2].getFullYear()).toBe(2026)
  })
})

describe('addDays', () => {
  it('adds positive days correctly', () => {
    const date = createDate(2025, 1, 15)
    const result = addDays(date, 5)

    expect(result.getDate()).toBe(20)
    expect(result.getMonth()).toBe(0) // January
  })

  it('handles negative days (subtraction)', () => {
    const date = createDate(2025, 1, 15)
    const result = addDays(date, -5)

    expect(result.getDate()).toBe(10)
  })

  it('handles month overflow', () => {
    const date = createDate(2025, 1, 30)
    const result = addDays(date, 5)

    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(4)
  })

  it('handles year overflow', () => {
    const date = createDate(2025, 12, 30)
    const result = addDays(date, 5)

    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0) // January
  })

  it('does not mutate original date', () => {
    const original = createDate(2025, 1, 15)
    const originalTime = original.getTime()
    addDays(original, 10)

    expect(original.getTime()).toBe(originalTime)
  })

  it('handles zero days', () => {
    const date = createDate(2025, 6, 15)
    const result = addDays(date, 0)

    expect(result.getDate()).toBe(15)
    expect(result.getMonth()).toBe(5) // June (0-indexed)
  })

  it('handles leap year', () => {
    const date = createDate(2024, 2, 28) // Feb 28, 2024 (leap year)
    const result = addDays(date, 1)

    expect(result.getDate()).toBe(29)
    expect(result.getMonth()).toBe(1) // February
  })
})

describe('startOfWeek', () => {
  it('returns Sunday for a mid-week date', () => {
    const wednesday = createDate(2025, 1, 15) // Wednesday
    const result = startOfWeek(wednesday)

    expect(result.getDay()).toBe(0) // Sunday
    expect(result.getDate()).toBe(12)
  })

  it('returns same day if already Sunday', () => {
    const sunday = createDate(2025, 1, 12) // Sunday
    const result = startOfWeek(sunday)

    expect(result.getDay()).toBe(0)
    expect(result.getDate()).toBe(12)
  })

  it('sets time to start of day', () => {
    const date = createDate(2025, 1, 15)
    date.setHours(14, 30, 45, 123)
    const result = startOfWeek(date)

    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('handles month boundary', () => {
    const date = createDate(2025, 2, 1) // Saturday, Feb 1
    const result = startOfWeek(date)

    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(26)
  })
})

describe('endOfWeek', () => {
  it('returns Saturday for a mid-week date', () => {
    const wednesday = createDate(2025, 1, 15) // Wednesday
    const result = endOfWeek(wednesday)

    expect(result.getDay()).toBe(6) // Saturday
    expect(result.getDate()).toBe(18)
  })

  it('returns same day if already Saturday', () => {
    const saturday = createDate(2025, 1, 18) // Saturday
    const result = endOfWeek(saturday)

    expect(result.getDay()).toBe(6)
    expect(result.getDate()).toBe(18)
  })

  it('sets time to end of day', () => {
    const date = createDate(2025, 1, 15)
    const result = endOfWeek(date)

    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })
})

describe('startOfMonth', () => {
  it('returns first day of month', () => {
    const date = createDate(2025, 3, 15)
    const result = startOfMonth(date)

    expect(result.getDate()).toBe(1)
    expect(result.getMonth()).toBe(2) // March (0-indexed)
  })

  it('returns same date if already first of month', () => {
    const date = createDate(2025, 6, 1)
    const result = startOfMonth(date)

    expect(result.getDate()).toBe(1)
  })
})

describe('endOfMonth', () => {
  it('returns last day of month for 31-day month', () => {
    const date = createDate(2025, 1, 15) // January
    const result = endOfMonth(date)

    expect(result.getDate()).toBe(31)
  })

  it('returns last day of month for 30-day month', () => {
    const date = createDate(2025, 4, 15) // April
    const result = endOfMonth(date)

    expect(result.getDate()).toBe(30)
  })

  it('returns 28 for February in non-leap year', () => {
    const date = createDate(2025, 2, 15) // February 2025
    const result = endOfMonth(date)

    expect(result.getDate()).toBe(28)
  })

  it('returns 29 for February in leap year', () => {
    const date = createDate(2024, 2, 15) // February 2024
    const result = endOfMonth(date)

    expect(result.getDate()).toBe(29)
  })
})

describe('isSameDay', () => {
  it('returns true for same date', () => {
    const date1 = createDate(2025, 6, 15)
    const date2 = createDate(2025, 6, 15)

    expect(isSameDay(date1, date2)).toBe(true)
  })

  it('returns true for same date with different times', () => {
    const date1 = new Date(2025, 5, 15, 9, 0, 0)
    const date2 = new Date(2025, 5, 15, 18, 30, 45)

    expect(isSameDay(date1, date2)).toBe(true)
  })

  it('returns false for different days', () => {
    const date1 = createDate(2025, 6, 15)
    const date2 = createDate(2025, 6, 16)

    expect(isSameDay(date1, date2)).toBe(false)
  })

  it('returns false for different months', () => {
    const date1 = createDate(2025, 6, 15)
    const date2 = createDate(2025, 7, 15)

    expect(isSameDay(date1, date2)).toBe(false)
  })

  it('returns false for different years', () => {
    const date1 = createDate(2025, 6, 15)
    const date2 = createDate(2024, 6, 15)

    expect(isSameDay(date1, date2)).toBe(false)
  })
})

describe('generateSlug', () => {
  it('converts to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('foo bar baz')).toBe('foo-bar-baz')
  })

  it('removes special characters', () => {
    expect(generateSlug('Hello! World?')).toBe('hello-world')
  })

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('--hello--')).toBe('hello')
    expect(generateSlug('  hello  ')).toBe('hello')
  })

  it('collapses multiple hyphens', () => {
    expect(generateSlug('foo   bar')).toBe('foo-bar')
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('handles numbers', () => {
    expect(generateSlug('Team 123')).toBe('team-123')
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('handles string with only special characters', () => {
    expect(generateSlug('!@#$%')).toBe('')
  })
})

describe('generateToken', () => {
  it('generates token of default length (32)', () => {
    const token = generateToken()
    expect(token).toHaveLength(32)
  })

  it('generates token of specified length', () => {
    expect(generateToken(16)).toHaveLength(16)
    expect(generateToken(64)).toHaveLength(64)
    expect(generateToken(8)).toHaveLength(8)
  })

  it('contains only alphanumeric characters', () => {
    const token = generateToken(100)
    expect(token).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('generates unique tokens', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken())
    }
    // All 100 tokens should be unique
    expect(tokens.size).toBe(100)
  })

  it('handles edge case of length 1', () => {
    const token = generateToken(1)
    expect(token).toHaveLength(1)
    expect(token).toMatch(/^[A-Za-z0-9]$/)
  })

  it('generates cryptographically random tokens (distribution test)', () => {
    // Generate many tokens and check character distribution
    // This is a basic sanity check that we're not just getting 'A' repeatedly
    const token = generateToken(1000)
    const uniqueChars = new Set(token.split(''))
    // With 62 possible chars and 1000 length, we should see most chars
    expect(uniqueChars.size).toBeGreaterThan(50)
  })
})

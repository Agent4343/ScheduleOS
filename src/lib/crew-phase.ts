import { phaseAt, type RotationPattern, type WorkingShift } from "./scheduling"
import { getTodayUTC } from "./timezone"

/** Rotation pattern fields the crew endpoints must select for phase display. */
export const crewPatternSelect = {
  id: true,
  name: true,
  daysOn: true,
  daysOff: true,
  includesNights: true,
  nightsAtStart: true,
  nightDays: true,
  alternatesShifts: true,
} as const

interface CrewWithAnchor {
  currentPhase: number
  rotationAnchorDate: Date | null
  anchorPhase: number
  anchorStartingShift: string | null
  rotationPattern: RotationPattern | null
}

/**
 * Replace the stored `currentPhase` with today's phase derived from the
 * crew's anchor. Crews without an anchor keep whatever was stored.
 *
 * `currentPhase` in the database is display-only; generation never reads it.
 */
export function withCurrentPhase<T extends CrewWithAnchor>(crew: T, today: Date = getTodayUTC()): T {
  if (!crew.rotationAnchorDate || !crew.rotationPattern) {
    return crew
  }
  return {
    ...crew,
    currentPhase: phaseAt(
      crew.rotationPattern,
      {
        anchorDate: crew.rotationAnchorDate,
        anchorPhase: crew.anchorPhase,
        anchorShift: (crew.anchorStartingShift === "NIGHT" ? "NIGHT" : "DAY") as WorkingShift,
      },
      today
    ),
  }
}

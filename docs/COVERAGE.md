# Role-based coverage

Coverage answers the question the operations spreadsheet answered with its
COUNTIF rows: *for each day and night, do we have enough people in each role?*

## The model

| Concept | Table / field | Spreadsheet equivalent |
| --- | --- | --- |
| **Coverage role** — something a shift must be staffed with, with a red/amber threshold per shift | `CoverageRole` (`minDay`, `targetDay`, `minNight`, `targetNight`, `requiredQualification`) | The count rows at the bottom (Outside Ops, Control Room…) and their colour rules |
| **Position group** — the block a worker sits in on the roster, and the role they fill by default | `PositionGroup` (`sortOrder`, `color`, `defaultCoverageRoleId`) and `User.positionGroupId` / `User.rosterOrder` | The row blocks (OIM, Production Supervisor, Production Leads, OCR Ops, Ops Techs) |
| **Duty code** — a custom shift type that moves a worker onto a different role for the day | `CustomShiftType.coverageRoleId`, `coverageShift`, `isBackfill` | OCR-D / CCR-D / BCCR-D / PL-D / PS / OIM codes |
| **Qualification** — free-text tags a role can require | `User.qualifications[]`, `CoverageRole.requiredQualification` | The CCR-trained asterisk |

Management groups simply have no default role, so they are never counted
toward operations lines (the spreadsheet did this by starting its counts at
row 16).

## How a schedule row is counted

`src/lib/services/coverage.ts` is a pure function of (rows, roles, groups,
codes) so it is easy to test (`src/lib/__tests__/coverage.test.ts`):

1. A `CUSTOM` row whose code has a `coverageRoleId` and `coverageShift`
   counts toward that role on that shift, regardless of the worker's group.
   `isBackfill` is just a flag shown on the roster.
2. A `DAY`/`NIGHT` (or `PL_DAY`/`PL_NIGHT`) row counts toward the worker's
   group default role on that shift.
3. Everything else (off, leave, training, a code with no role, a worker
   with no group) is ignored.
4. If the role requires a qualification the worker lacks, they are listed on
   the line but not counted.

A line is **red** when `have < min`, **amber** when `have < max(min,
target)`, otherwise **ok**. A day's status is its worst line. Lines with no
requirement (min and target both 0) are omitted.

## Where it shows up

* **Settings → Coverage** (`/settings#coverage`): roles, groups and the
  one-click *Offshore ops template* (`src/lib/services/coverage-template.ts`),
  which creates the five roles, five groups and thirteen duty codes from the
  workbook. Duty-code coverage fields live on each custom shift type in the
  card below it.
* **Workers**: the worker form has position group, roster order and
  qualifications once at least one group exists.
* **Schedule**: rows are ordered by group → roster order → name with a
  divider per group, matching the roster layout.
* **Coverage** (`/coverage`, staff only): a two-week board, one column per
  day and one row per (role, shift), cells showing *have / minimum*. Click a
  cell to see who is on, how they got there (their group or a duty code),
  and who is not counted.

## API

| Route | Notes |
| --- | --- |
| `GET/POST /api/coverage-roles`, `PATCH/DELETE /api/coverage-roles/:id` | admin writes |
| `GET/POST /api/position-groups`, `PATCH/DELETE /api/position-groups/:id` | admin writes |
| `GET /api/coverage?startDate&endDate` | up to 92 days; returns `{ configured, roles, groups, days }` |
| `POST /api/coverage/template` | admin; idempotent |

Migration: `prisma/migrations/20260908090000_role_based_coverage` (additive
only — new tables, nullable columns and an empty-array default).

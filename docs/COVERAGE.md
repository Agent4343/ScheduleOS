# Role-based coverage

Coverage answers the question the operations spreadsheet answered with its
COUNTIF rows: *for each day and night, do we have enough people in each role?*

## The model

| Concept | Table / field | Spreadsheet equivalent |
| --- | --- | --- |
| **Coverage role** — something a shift must be staffed with, with a red/amber threshold per shift | `CoverageRole` (`minDay`, `targetDay`, `minNight`, `targetNight`, `requiredQualification`) | The count rows at the bottom (Outside Ops, Control Room…) and their colour rules |
| **Position group** — the block a worker sits in on the roster, and the role they fill by default | `PositionGroup` (`sortOrder`, `color`, `defaultCoverageRoleId`) and `User.positionGroupId` / `User.rosterOrder` | The row blocks (OIM, Production Supervisor, Production Leads, OCR Ops, Ops Techs) |
| **Duty code** — a custom shift type that moves a worker onto a different role for the day | `CustomShiftType.coverageRoleId`, `coverageShift`, `isBackfill` | OCR-D / CCR-D / BCCR-D / PL-D / PS / OIM codes |
| **Sign-off** — a training qualification, defined once per organization | `Qualification` (`code`, `name`), held via `User.qualifications[]` | The CCR-trained asterisk, the operator disciplines |
| **Sign-off requirement** — N *distinct* holders needed on a shift | `CoverageRequirement` (`countDay`, `countNight`) | "we always need a utilities, an oil and a gas operator" |

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
5. The line's sign-off requirements are then resolved against whoever is
   counted — see below.

A line is **red** when `have < min`, **amber** when `have < max(min,
target)`, otherwise **ok**. A day's status is its worst line. Lines with no
requirement (min and target both 0) are omitted.

## Sign-offs: one person, one job

Outside ops needs somebody signed off on utilities, somebody on oil and
somebody on gas — and they must be three different people. Counting holders
per sign-off gets this wrong: a crew where one operator holds both oil and
gas, and nobody else holds either, passes a count of "≥1 oil, ≥1 gas" but
cannot actually run, because that operator cannot be in two places.

So the evaluator does not count — it **assigns**. Each requirement is expanded
into slots (`2 × oil` becomes two slots), and `matchSignOffs` runs a maximum
bipartite matching (Kuhn's algorithm) between slots and the people counted on
the line, where an edge exists if the person holds that sign-off. Every slot
matched means the shift can be staffed; any unmatched slot is a real gap, and
makes the line **red regardless of headcount** — a full crew missing a gas
operator is still a shift that cannot run.

The augmenting-path step matters for a subtle case: if the only gas operator
also holds oil and gets taken by oil first, the algorithm backs up, moves them
to gas, and gives oil to somebody else. A greedy first-fit would report a
false shortfall.

Sizes here are single digits, so the simple algorithm is far more than fast
enough. Tests covering all of this are in `src/lib/__tests__/coverage.test.ts`.

Note that a worker who moves to another role on a duty code — a CCR-trained
outside operator on `CCR-D`, say — is on the Control Room line that shift and
is no longer available to outside ops, so their sign-offs go with them. That
falls out of the model rather than being a special case.

## Where it shows up

* **Settings → Coverage** (`/settings#coverage`): roles, groups and the
  one-click *Offshore ops template* (`src/lib/services/coverage-template.ts`),
  which creates the five roles, five groups and thirteen duty codes from the
  workbook. Duty-code coverage fields live on each custom shift type in the
  card below it.
* **Workers**: the worker form has position group, roster order, and a
  checkbox per sign-off.
* **Schedule**: rows are ordered by group → roster order → name with a
  divider per group, matching the roster layout. **Full screen** drops all
  page chrome and shows only names and shifts; Escape exits.
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
| `GET/POST /api/qualifications`, `PATCH/DELETE /api/qualifications/:id` | admin writes; renaming a code rewrites it on every holder, deleting strips it |
| `PUT /api/coverage-roles/:id/requirements` | replaces a role's sign-off requirements as a set |

Migrations: `20260908090000_role_based_coverage` and
`20260908110000_qualification_sign_offs`, both additive only.

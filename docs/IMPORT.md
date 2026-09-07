# Importing a roster spreadsheet

**Settings → Import from a spreadsheet** (admins only) loads an operations
roster workbook: people, position groups, sign-offs and a year of shifts.

## Why it previews first

These workbooks have a *convention*, not a format. Nothing in the file says
which row holds the dates, which rows are headings, or what an asterisk on a
name means — the parser infers all of it. So the import is two passes over the
same file: the first only reports what it found, and nothing is written until
someone confirms it. The preview is the safety mechanism, not the parser.

## What it works out

| Thing | How |
| --- | --- |
| The sheet | The one that scores highest on short, repeating cell values — a codes sheet, rather than a derived view full of names. Override it with the dropdown. |
| The calendar | The longest run of adjacent header cells whose dates run *forwards*. |
| The name column | The leftmost populated column left of the calendar. |
| Position groups | A labelled row with no shifts and no other data is a heading; the people below it belong to it. |
| Sign-offs | A trailing `*` on a name means CCR trained, the workbook's own convention. |
| Shift codes | `D` and `N` become day and night; everything else is kept as a duty code. |
| Roster order | Sheet order, preserved. |

Two of these were wrong in the obvious implementation, and both are covered by
tests in `src/lib/__tests__/schedule-import.test.ts`:

* **A stray date.** A `TODAY()` cell in column A of the header row is a date,
  but not part of the calendar. Treating every date cell as a column dragged
  column A in, shifted the whole read, and turned people's names into shift
  codes. Requiring the calendar to be adjacent *and* forward-running excludes it.
* **A vacant row.** A placeholder like `TBA` has no shifts all year and so
  looks exactly like a group heading — and would then silently adopt everyone
  listed beneath it. What distinguishes them is the other columns: a person
  carries a crew code there, a heading is bare.

A row that is genuinely ambiguous — bare, and with no shifts — is reported in
the preview rather than guessed at.

## What it writes

In one transaction, so a failed import cannot leave a half-written roster:

1. Position groups that do not exist yet, in sheet order.
2. Sign-offs referenced by the sheet.
3. People: matched to existing workers **by name**, updating their group,
   roster order and sign-offs. Unmatched people are created only if you tick
   the box; they get a placeholder address and no password, so they appear on
   the roster but cannot sign in until given a real one. Unticked, their
   shifts are skipped.
4. Shift codes the sheet uses that the organization lacks, in grey and with no
   coverage role — set what each counts toward under Coverage afterwards.
5. Shifts. Existing shifts in the imported range, for the matched people, are
   deleted first, so re-importing a corrected sheet replaces rather than
   layers. **This discards manual overrides in that range.**

## Verification

The parser and evaluator were checked against a real 2026 operations workbook:
36 people, 396 days, 6,941 shifts. Its output was compared against the
workbook's own `COUNTIF` rows — outside ops and control room, days and nights,
every day of the year. **1,584 figures, no mismatches.**

Worth knowing what that does and does not establish: it confirms the parser
and the coverage rules agree with the spreadsheet. It says nothing about the
database write path, which has no equivalent test.

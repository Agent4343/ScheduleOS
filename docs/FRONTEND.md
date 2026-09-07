# Frontend conventions

How pages under `src/app/(dashboard)` talk to the API, handle dates, roles and feedback. New code should follow this; older pages are being moved over one at a time (Crews and Workers are the reference implementations).

## Talking to the API

Never call `fetch("/api/…")` from a page. Use a feature module:

```
src/features/<feature>/
  api.ts        typed functions over src/lib/api-client.ts   (crewsApi.list(), crewsApi.update(id, input))
  hooks.ts      react-query hooks + query keys                (useCrews(), useUpdateCrew())
  components/   forms and widgets owned by the feature       (CrewForm, WorkerForm)
```

`src/lib/api-client.ts` does the JSON, envelope unwrapping and error handling once. A failed call throws `ApiError` with the server's message; render it with `errorMessage(error)`.

Reads are `useQuery`, keyed by every parameter (`scheduleKeys.range(query)`), which is what stops a slow earlier response from overwriting a newer one. Writes are `useMutation` whose `onSuccess` invalidates the keys they affect, so there are no manual "refetch after save" blocks.

Shared response types live in `src/features/types.ts`. Do not redeclare `interface Crew` in a page.

## Dates

The API stores calendar dates as UTC midnight and serialises them as `"2026-03-02T00:00:00.000Z"`. `new Date(that).toLocaleDateString()` shows **March 1** in Newfoundland. Use `src/lib/dates.ts`:

- `formatDateOnly(value, "short" | "medium" | "long" | "weekday")` for display
- `parseDateOnly(value)` when you need `getDay()` / `getDate()`
- `todayKey()`, `addDaysKey()`, `addMonthsKey()`, `monthStartKey()`, `monthEndKey()` for `YYYY-MM-DD` arithmetic

Real instants (`createdAt`, `checkInTime`) are fine with `new Date(ts).toLocaleString()`. ESLint warns on `new Date(x).toLocaleDateString()` to catch the date-only case.

## Roles

- Page access: put the page under `(dashboard)/(staff)` (admin + supervisor) or `(dashboard)/(admin)`. The group layout calls `requirePageRole()` server-side and redirects. `src/lib/navigation.ts` carries the same `roles` per item, so the sidebar and the guard cannot disagree.
- Inside a page: `const { isAdmin, isStaff, userId } = useRole()` to show or hide controls. The API enforces the rules independently; the UI just avoids offering forms that will be refused.

## Feedback

- `useToast()` → `toast.success("Crew created")` / `toast.error(errorMessage(e))`. No `alert()`.
- `useConfirm()` → `await confirm({ title, description, destructive, typeToConfirm })`. No `confirm()` / `prompt()`.
- Loading: render the query's `isPending` skeleton; errors: an `<Alert variant="destructive">` with a Retry that calls `refetch()`.

## UI primitives

`Button` (a real `<button>`), `LinkButton` (a `next/link` styled as a button — use it instead of wrapping a Button in a Link), `Switch` (accessible toggle), `Modal`, `Select`, `Input`, `Label`, `Badge`, `Card`, `Table`, `Alert`.

## Dialog state

One `dialog` state per page — `{ kind: "create" } | { kind: "edit"; crew } | null` — instead of a boolean per modal plus an "editing" object. Give the edit form a `key={item.id}` so it resets when a different item is opened.

## One component per job

Things that used to exist in several copies now have exactly one home:

| Job | Component | Used by |
|---|---|---|
| Generate or extend a rotation | `features/schedules/components/generate-schedule-dialog.tsx` | Crews, Schedule (per worker), Getting Started |
| Set a shift over a date range | `features/schedules/components/override-shift-dialog.tsx` (POST `/api/schedules/bulk`, one request) | Schedule |
| Year grid | `features/schedules/components/schedule-grid.tsx` (memoised `DayCell`) | Schedule |
| Add / edit a worker | `features/workers/components/worker-form.tsx` (`workerPayload()` builds the API body) | Workers, Schedule, Settings → Add User, Getting Started |
| Coverage board | `features/coverage/components/coverage-board.tsx`, data from `features/coverage/hooks.ts` (see docs/COVERAGE.md) | Coverage |
| Coverage rules | `features/settings/components/coverage-card.tsx` | Settings |
| Add / edit a crew | `features/crews/components/crew-form.tsx` | Crews, Getting Started |
| Settings sections | `features/settings/components/*-card.tsx`, framed by `SettingsCard` | Settings |

Settings has no "Save All": `useOrgSettings().saveSettings(patch)` persists each change immediately (the server merges the keys you send). Getting Started is a checklist over `/api/setup-status`; it opens the same dialogs as the real pages rather than carrying its own forms. The old `/setup` wizard is gone.

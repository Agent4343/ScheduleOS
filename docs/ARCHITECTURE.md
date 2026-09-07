# Architecture

ShiftSync is a single Next.js 14 application (App Router) talking to one
Postgres database through Prisma. There is no separate backend service: API
routes, pages and background logic all live in `src/`, deployed to Railway as
one container.

```
Browser ──► Next.js App Router ──► /api routes ──► service layer ──► Prisma ──► Postgres
              (React pages)                            ▲
                                                       │
                                       AI assistant tools ──► same services
```

## The layers, outermost first

### 1. Pages — `src/app/`

Route groups carry the access rules, so a page cannot be reachable by URL yet
hidden from the menu:

| Group | Who | Guard |
| --- | --- | --- |
| `(dashboard)` | any signed-in user | layout requires a session |
| `(dashboard)/(staff)` | admins and supervisors | `requirePageRole` |
| `(dashboard)/(admin)` | admins | `requirePageRole` |

`src/lib/navigation.ts` is the single list of pages and the roles that may see
each one. The sidebar, the mobile drawer and the route guards all read it.

### 2. Feature modules — `src/features/<feature>/`

Everything a feature needs, next to itself:

```
src/features/coverage/
  hooks.ts        react-query hooks + the feature's response types
  api.ts          thin wrappers over apiGet/apiSend (when a feature needs them)
  components/     presentational components, no data fetching
```

Pages compose features; features never import from pages. Shared response
types live in `src/features/types.ts` — a page must not redeclare
`interface Crew`.

Data fetching is react-query over `src/lib/api-client.ts` (`apiGet`,
`apiSend`, `qs`, `errorMessage`). Components never call `fetch` directly.

### 3. API routes — `src/app/api/`

Routes are thin. Their whole job is: authenticate, validate, delegate, format.

```ts
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth({ roles: ["ADMIN"] })
    if (auth.error) return auth.error
    const body = await parseBody(someSchema, request)   // Zod
    const result = await someService(body, auth.session.user)
    return apiOk(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error, "Failed to …")
  }
}
```

`src/lib/api-helpers.ts` provides `parseBody` / `apiOk` / `apiError` /
`handleRouteError`; `src/lib/api-auth.ts` provides `requireAuth`. Business
rules do not live here.

### 4. Services — `src/lib/services/`

Where the rules live, and the reason the AI assistant and the REST API can
never disagree: both call the same functions. A service takes plain input plus
an `Actor` (the acting user and their organization), enforces the rules, and
throws `ServiceError(message, status)` on refusal — which `handleRouteError`
turns into the right HTTP response.

| Module | Responsibility |
| --- | --- |
| `schedules.ts` | generating, overriding and reading schedules |
| `workers.ts`, `crews.ts` | people and crews, with org-scoping checks |
| `coverage.ts` | is each shift adequately staffed (see COVERAGE.md) |
| `time-off.ts`, `swaps.ts` | requests and approvals |
| `summaries.ts` | dashboard and report aggregates |

### 5. Domain logic — `src/lib/`

Pure functions with no database access, which is what makes them testable:

* `scheduling.ts` — rotation maths. `shiftTypeAt(anchor, date)` answers "what
  shift is this crew on, that day" from an anchor date rather than by counting
  forward from an arbitrary origin, so a rotation can be corrected without
  rewriting history.
* `timezone.ts` — `businessDateInTimeZone`, `toUTCDate`. Every date-only value
  is stored at UTC midnight; see "Dates" below.
* `dates.ts` — the browser-side counterparts (`formatDateOnly`,
  `parseDateOnly`, `toDateKey`).

### 6. The AI assistant — `src/lib/assistant/`

Tool definitions map one-to-one onto service functions. The assistant cannot
reach the database except through them, so it inherits every permission check
for free. Adding a capability means adding a tool that calls an existing
service, never new database code.

## Cross-cutting decisions

### Dates

A shift belongs to a *calendar day*, not an instant. Date-only values are
stored as UTC midnight and rendered with `formatDateOnly` / `parseDateOnly`.
Using `new Date(value).toLocaleDateString()` shows the previous day anywhere
west of UTC — St. John's, for instance — so an ESLint rule
(`no-restricted-syntax`) rejects it. Tests run under `TZ=America/St_Johns`
precisely so this class of bug fails in CI rather than in production.

### Authorization

Three roles — `ADMIN`, `SUPERVISOR`, `WORKER` — checked in three places, each
with a different job:

1. `navigation.ts` decides what is *shown*.
2. `requirePageRole` decides what is *reachable*.
3. `requireAuth({ roles })` decides what is *permitted*, and is the one that
   actually protects data.

Every query is scoped by `organizationId`; services verify that referenced
records belong to the caller's organization before touching them.

### Migrations

`prisma/migrations/` is the source of truth and `prisma migrate deploy` runs
on every boot (see `nixpacks.toml`). Migrations are written to be additive and
re-runnable where practical, because production was baselined from a database
this repository did not create — see docs/DEPLOYMENT.md for that history and
for why `migrate diff` output should never be applied blindly.

## Testing

Vitest, in `src/lib/__tests__/`. The pure modules — scheduling, timezone,
coverage, permissions, rate limiting — carry the coverage, because they hold
the rules worth protecting. Tests that import a Prisma-backed module mock it
(`vi.mock("../prisma", () => ({ prisma: {} }))`) rather than reaching for a
database.

## Further reading

* [DEPLOYMENT.md](DEPLOYMENT.md) — Railway, environment variables, migration history
* [FRONTEND.md](FRONTEND.md) — conventions, and where each shared component lives
* [COVERAGE.md](COVERAGE.md) — the role-based coverage model

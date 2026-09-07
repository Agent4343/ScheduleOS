# ShiftSync

Workforce scheduling for organizations that run continuous rotating shifts —
offshore oil and gas, manufacturing, healthcare, construction.

A single Next.js 14 application backed by Postgres, deployed on Railway.

## What it does

* **Rotating crews.** 2-on/2-off, 3-on/3-off, 14-on/14-off or a custom
  pattern, generated from an anchor date so a rotation can be corrected
  without rewriting past schedules.
* **Year-at-a-glance schedule.** One row per worker, one column per day,
  editable in place, with a per-day and per-range override dialog.
* **Role-based coverage.** Position groups, duty codes and per-shift minimum
  and target headcounts, with a board that shows at a glance which days are
  short and who is on. See [docs/COVERAGE.md](docs/COVERAGE.md).
* **Attendance, time off, shift swaps, announcements**, each with an approval
  path and staffing-impact checks.
* **An AI assistant** that reaches the database only through the same service
  functions the API uses, so it inherits every permission check.

## Quick start

Requires Node 22 (see `.nvmrc`) and a Postgres database.

```bash
git clone https://github.com/Agent4343/ScheduleOS.git
cd ScheduleOS
npm install
cp .env.example .env      # then edit DATABASE_URL and NEXTAUTH_SECRET
npm run db:migrate        # create the schema
npm run db:seed           # organization, crews, rotation patterns
npm run dev
```

Open <http://localhost:3000>.

To get an admin account, either seed one —

```bash
SEED_DEMO=true SEED_DEMO_PASSWORD=<your password> npm run db:seed
```

— which creates `admin@local`, or open `npx prisma studio` and set an existing
user's role to `ADMIN`.

## Environment variables

| Variable | Description | Required |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection (Railway sets this) | yes |
| `DIRECT_URL` | Direct connection used for migrations | yes |
| `NEXTAUTH_URL` | The app's public URL | yes |
| `NEXTAUTH_SECRET` | 32-byte secret — `openssl rand -base64 32` | yes |
| `ANTHROPIC_API_KEY` | Enables the AI assistant | no |
| `SENTRY_DSN` | Error reporting | no |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Distributed rate limiting; falls back to in-memory | no |

`.env.example` carries the full list with comments.

## Deployment

Railway builds from `nixpacks.toml` and runs `prisma migrate deploy` on every
boot, so shipping a migration is just merging it.

**If you are attaching an existing database** that this repository did not
create, do not run `prisma migrate diff` and apply the result — it will
propose dropping tables. Follow the baseline procedure in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), which explains what happened to this
project's own production database and how it was reconciled.

## Documentation

| Document | What's in it |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is put together and why |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Frontend conventions; where each shared piece lives |
| [docs/COVERAGE.md](docs/COVERAGE.md) | The role-based coverage model |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Railway, environment, migration history |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Pre-launch checks |
| [SECURITY.md](SECURITY.md) | Reporting a vulnerability |

## Scripts

```bash
npm run dev                # development server
npm run build              # production build
npm run start              # production server
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm test                   # vitest
npm run db:migrate         # apply pending migrations
npm run db:migrate:dev     # create a migration from schema changes (local only)
npm run db:migrate:status  # applied / pending
npm run db:migrate:check   # fail if schema.prisma drifted from prisma/migrations
npm run db:studio          # browse the database
npm run db:seed            # seed
```

CI runs typecheck, lint, tests and a production build on every push
(`.github/workflows/ci.yml`).

## Project layout

```
src/
├── app/
│   ├── (auth)/              sign-in, register
│   ├── (dashboard)/         signed-in pages
│   │   ├── (staff)/         admin + supervisor only
│   │   └── (admin)/         admin only
│   └── api/                 route handlers (thin: auth, validate, delegate)
├── features/<feature>/      hooks, api wrappers and components per feature
├── components/ui/           shared primitives (button, modal, toast, …)
└── lib/
    ├── services/            business rules, shared by the API and the assistant
    ├── assistant/           AI tool definitions
    ├── scheduling.ts        rotation maths (pure)
    ├── timezone.ts          date-only handling (pure)
    └── validations.ts       Zod schemas
prisma/migrations/           the source of truth for the database
ios/                         native iOS companion app (built separately)
```

## Licence

See [LICENSE](LICENSE).

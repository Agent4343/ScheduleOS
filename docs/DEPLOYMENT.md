# Deployment

How ShiftSync gets from a commit on `main` to a running server on Railway, and how the database schema is kept in step with it.

## What runs on a deploy

Railway reads `railway.json` (it takes precedence over `nixpacks.toml`, which is kept in sync for local Nixpacks builds).

1. **Build** — `npm run build` (`prisma generate && next build`), then the standalone output is assembled: static assets, `public/`, and the generated Prisma client are copied into `.next/standalone/`.
2. **Start** — `npx prisma migrate deploy && node .next/standalone/server.js`.
   Pending migrations in `prisma/migrations/` are applied first. If a migration fails, the server does not start and the previous deployment keeps serving. Railway retries up to 3 times (`restartPolicyMaxRetries`).
3. **Healthcheck** — `GET /api/health` must return 200. It returns 503 when the database is unreachable, so a deploy with a bad `DATABASE_URL` is rolled back rather than marked healthy.

`src/instrumentation.ts` runs once per server process and only initialises Sentry. It no longer touches the database.

## Environment variables

| Variable | Required | Used by |
|---|---|---|
| `DATABASE_URL` | yes | Prisma client (queries). Set automatically by Railway's Postgres service. |
| `DIRECT_URL` | yes | `prisma migrate deploy` at startup. Set it by hand: `${{Postgres.DATABASE_URL}}` unless you use a pooler. |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | yes | Sessions |
| `CRON_SECRET` | if using auto-checkout cron | `POST /api/attendance/auto-checkout` |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | recommended | Error reporting (server, edge, browser) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | recommended | Distributed rate limiting; falls back to in-memory per replica |
| `STRIPE_*`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` | optional | Billing, AI assistant, email |

`SETUP_KEY` is no longer used; the `/api/setup` and `/api/migrate` endpoints were removed.

## Migrations

The schema has exactly one source of truth: `prisma/schema.prisma`, with its history in `prisma/migrations/`. Every schema change is a migration file that is reviewed in the PR and applied by `prisma migrate deploy` on the next deploy.

### Changing the schema (local)

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate and apply a migration against your local database
npm run db:migrate:dev -- --name add_crew_anchor_date
# 3. Commit prisma/schema.prisma AND the new folder under prisma/migrations/
```

Never run `prisma db push` against a database that has migrations. It edits the schema without recording a migration, and the next `migrate deploy` will either fail or, worse, `migrate dev` will try to "fix" production with a destructive diff.

### Checking for drift

`npm run db:migrate:check` compares `prisma/schema.prisma` against what `prisma/migrations/` would build, and exits non-zero on any difference. It needs `SHADOW_DATABASE_URL` pointing at an empty scratch database Prisma may create and drop tables in. Run it before opening a PR that touches the schema; CI should run it too.

## What actually happened to this project's production database

Worth reading before you touch production, because the baseline did not go to plan.

Production was built before this repository had a migrations folder (`prisma db push` plus hand-written SQL), so `0_init` was recorded as applied without being run — the procedure below. The assumption behind that step was that the live schema already matched `0_init`.

It did not. The database had been shaped by an **earlier, more built-out fork** of the application, and `prisma db pull` showed the real picture:

* **Extra tables production has and this repository does not:** `Department`, `CustomRole`, `CertificationType`, `UserCertification`, `TransferRequest`, plus Stripe billing columns on `Organization` (`stripeCustomerId`, `subscriptionTier`, `workerLimit`, …) and extra `User` columns (`sortOrder`, `departmentId`, `includeInStaffingCount`, `isControlRoomTrained`, `isGasOperatorTrained`, …).
* **Tables this repository needs and production never had:** `ShiftCheckIn`, `ShiftSwap`, `Announcement`, `AuditLog` — because `0_init` was recorded rather than run. Attendance, shift swaps, announcements and the audit log were failing in production until `20260908100000_missing_core_tables` created them.

Two rules follow, and they matter:

1. **Never apply `prisma migrate diff` output against production.** Because those extra tables are absent from `schema.prisma`, the diff proposes `DROP TABLE` on all of them. It is a data-loss command wearing a migration's clothes.
2. **Write migrations defensively.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and `DO $$ … EXCEPTION WHEN duplicate_object $$` for enums and constraints, so a migration is safe on a database whose exact state you cannot be certain of. `20260908100000_missing_core_tables` is the worked example.

The extra tables remain unmodelled: Prisma simply ignores tables it does not know about, so they are inert at runtime. Folding them into `schema.prisma` — or migrating their data into the coverage model, which covers much of the same ground — is unfinished business.

### The baseline procedure

For reference, and for any other pre-existing database:

```bash
# From a machine that can reach the production database.
# Use the DIRECT (non-pooled) connection string.
export DATABASE_URL="postgresql://…"   # production
export DIRECT_URL="$DATABASE_URL"

# 1. Confirm the live schema really matches the schema file. Any output here
#    means production has drifted and needs a corrective migration first.
npx prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 2. Record 0_init as applied. This only inserts a row into _prisma_migrations.
npx prisma migrate resolve --applied 0_init

# 3. Verify
npx prisma migrate status     # → "Database schema is up to date!"
```

After that, every deploy runs `prisma migrate deploy`, which finds nothing pending until the next real migration lands.

If step 1 prints SQL, do **not** run `resolve`. Save the output as a new migration (`prisma/migrations/<timestamp>_align_production/migration.sql`), review it, then run `resolve --applied` for both `0_init` and the new one once you've confirmed the SQL matches what's already live — or apply the differences with `migrate deploy` if production is the one that's behind.

### Fresh environments (preview, staging, local)

Nothing special. `prisma migrate deploy` (or `npm run db:migrate`) creates the schema from `0_init` onward. Then `npm run db:seed` for demo data.

## Rolling back

Prisma migrations are forward-only. To undo a schema change, write a new migration that reverses it. For an application-only rollback, redeploy the previous Railway deployment; the schema stays as it is, which is safe as long as migrations are additive (add columns with defaults; drop columns in a later release once no running code reads them).

## Sentry

`sentry.client.config.ts` is loaded automatically by `@sentry/nextjs`. The server and edge configs are **not**: `src/instrumentation.ts` imports them per runtime and exports `onRequestError` so route handler and RSC errors are captured. `src/app/global-error.tsx` reports errors thrown by the root layout. Errors are only sent when `NODE_ENV=production` and `SENTRY_DSN` is set.

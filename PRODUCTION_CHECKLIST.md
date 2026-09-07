# Production Deployment Checklist

## Environment Variables Required

```bash
# Database (DIRECT_URL is used by prisma migrate deploy at startup)
DATABASE_URL="postgresql://user:password@host:5432/database"
DIRECT_URL="postgresql://user:password@host:5432/database"

# Cron secret for POST /api/attendance/auto-checkout
CRON_SECRET="generate-with-openssl-rand-base64-32"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Error Monitoring (Sentry)
SENTRY_DSN="https://xxx@sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

## Database Migrations

- [ ] `prisma/migrations/` is committed and `npm run db:migrate:status` shows no pending migrations
- [ ] Existing database has been baselined once (`prisma migrate resolve --applied 0_init`) — see docs/DEPLOYMENT.md
- [ ] Start command runs `prisma migrate deploy` before the server (railway.json)

## Railway Database Backups

Railway automatically provides:
- ✅ **Point-in-time recovery** - Last 7 days
- ✅ **Daily snapshots** - Automatic

To enable/verify:
1. Go to Railway Dashboard → Your Project → Database
2. Click "Settings" tab
3. Verify "Backups" is enabled
4. Test restore by creating a backup manually

## Sentry Setup

1. Create account at https://sentry.io
2. Create a new Next.js project
3. Copy the DSN to your environment variables
4. Deploy and verify errors are tracked

## Security Checklist

- [x] Security headers configured (HSTS, CSP, X-Frame-Options)
- [x] Authentication middleware protecting routes
- [x] Rate limiting utility available
- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] SQL injection protected (Prisma ORM)
- [x] XSS protected (React auto-escaping)
- [ ] Custom domain with SSL (Railway provides free SSL)

## Performance Checklist

- [x] Standalone output for optimized builds
- [x] Console logs removed in production
- [x] Response compression enabled
- [x] Static assets optimized

## Monitoring

After deployment, verify:
1. Health endpoint: `GET /api/health`
2. Sentry receiving errors
3. Railway metrics showing normal traffic

## Timezone Notes

All schedule dates are stored as UTC midnight to ensure consistency.
The `src/lib/timezone.ts` utility provides helpers for:
- Converting date strings to UTC dates
- Comparing dates across timezones
- Formatting dates for display

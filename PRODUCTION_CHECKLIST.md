# Production Deployment Checklist

## Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"
DIRECT_URL="postgresql://user:password@host:5432/database"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Setup/Migration Protection (REQUIRED)
SETUP_KEY="generate-with-openssl-rand-base64-32"

# Email Notifications (Optional but recommended)
RESEND_API_KEY="re_xxx"
EMAIL_FROM="ScheduleOS <noreply@yourdomain.com>"

# Error Monitoring (Sentry)
SENTRY_DSN="https://xxx@sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

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
- [x] Rate limiting implemented on auth endpoints
- [x] Passwords hashed with bcrypt (cost factor 12)
- [x] SQL injection protected (Prisma ORM)
- [x] XSS protected (React auto-escaping + HTML escaping in emails)
- [x] CSV injection protected (formula escaping in exports)
- [x] Setup endpoints protected with SETUP_KEY
- [ ] Custom domain with SSL (Railway provides free SSL)
- [ ] SETUP_KEY environment variable configured

## Performance Checklist

- [x] Standalone output for optimized builds
- [x] Debug logs removed from production code
- [x] Response compression enabled
- [x] Static assets optimized
- [ ] Database connection pooling configured (recommend setting in production)

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

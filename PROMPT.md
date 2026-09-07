# ShiftSync — Full Application Prompt

## Overview

ShiftSync is a production-grade, AI-powered workforce scheduling platform built for industries that operate 24/7 with rotating shift patterns — oil & gas, mining, energy & utilities, and manufacturing. It replaces spreadsheet-based scheduling with a complete system for crew rotations, time-off management, attendance tracking, shift swaps, staffing compliance, reporting, and an AI assistant that can query and modify schedules through natural language.

**Live URL:** https://scheduleos-production.up.railway.app
**Stack:** Next.js 14 (App Router), TypeScript, PostgreSQL, Prisma ORM, NextAuth.js (JWT), Tailwind CSS, Stripe, Anthropic Claude API, Upstash Redis, Sentry, Resend

---

## Tech Stack & Architecture

### Frontend
- **Framework:** Next.js 14 with App Router (React 18, TypeScript)
- **Styling:** Tailwind CSS with `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`
- **UI Components:** Custom component library (shadcn/ui pattern) — Button, Card, Input, Select, Dialog, Badge, Skeleton, etc.
- **Icons:** Lucide React
- **State:** React Query (`@tanstack/react-query`) for server state, React Hook Form + Zod for forms
- **Theme:** `next-themes` (Light / Dark / System)

### Backend
- **API:** Next.js API Routes (Route Handlers)
- **Database:** PostgreSQL via Prisma ORM (`@prisma/client`)
- **Auth:** NextAuth.js v4 with JWT session strategy, bcryptjs password hashing (salt rounds: 12)
- **Rate Limiting:** Upstash Redis (`@upstash/redis`) with in-memory fallback
- **Payments:** Stripe (checkout sessions, webhooks, subscription lifecycle)
- **Email:** Resend
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — Claude Sonnet for the scheduling assistant
- **Error Tracking:** Sentry (`@sentry/nextjs`)
- **Deployment:** Railway (PostgreSQL + Web Service)

### Security
- CSRF origin verification on all mutating requests (POST/PUT/PATCH/DELETE), exempts Stripe webhooks
- HSTS header (max-age=63072000, includeSubDomains, preload)
- Content Security Policy (script-src 'self' 'unsafe-inline' for Next.js 14 hydration compatibility)
- X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy
- Permissions-Policy: camera=(self), microphone=(), geolocation=()
- Rate limiting on auth and registration endpoints
- Organization-scoped data isolation on all queries
- Sentry PII filtering (strips authorization, cookie, x-forwarded-for headers)

---

## Database Schema (Prisma)

### Core Models

**Organization**
- id, name, slug (unique), settings (JSON — stores plan, subscription info, timezone, date format, theme, notification preferences, auto-checkout config)
- Relations: users, crews, rotationPatterns, staffingRules, shutdowns, holidays, invitations, customShiftTypes, aiChatSessions, shiftSwaps, announcements, auditLogs

**User**
- id, email (unique), emailVerified, name, passwordHash, image
- role: ADMIN | SUPERVISOR | WORKER
- position, positionType: OPERATOR | ONSHORE_CONTROL_ROOM | OTHER
- phone, hireDate, status: ACTIVE | INACTIVE | ON_LEAVE | TERMINATED
- organizationId, crewId (optional)
- Relations: schedules, timeOffRequests, shiftCheckIns, notifications, announcements, auditLogs, aiChatSessions

**Crew**
- id, name, description, color (#hex), currentPhase (int)
- organizationId, rotationPatternId (optional)
- Relations: workers, schedules, staffingRules
- Unique constraint: (organizationId, name)

**RotationPattern**
- id, name, description, daysOn (int), daysOff (int)
- includesNights (bool), nightsAtStart (bool), nightDays (int), alternatesShifts (bool)
- patternDefinition (JSON), isDefault (bool)
- organizationId
- Relations: crews

**Schedule**
- id, date (Date), shiftType (enum), customShiftCode (string, optional)
- isOverride (bool), overrideReason, notes
- userId, crewId (denormalized for fast queries)
- Unique constraint: (userId, date)

**ShiftType enum:** DAY, NIGHT, OFF, LEAVE, PL_DAY, PL_NIGHT, VACATION, SICK, TRAINING, SHUTDOWN, CUSTOM

**CustomShiftType**
- id, code (short string), name, color (#hex), textColor (#hex), description, isActive (bool)
- organizationId

**ShiftCheckIn** (Attendance)
- id, date, checkInTime (DateTime), checkOutTime (DateTime, optional), autoCheckedOut (bool), notes
- userId, scannedById (optional — who scanned the QR code)
- Unique constraint: (userId, date)

**TimeOffRequest**
- id, startDate, endDate, type (enum), status (enum), reason, notes, adminNotes
- userId, approvedById (optional), approvedAt
- TimeOffType: VACATION | SICK | PERSONAL | BEREAVEMENT | JURY_DUTY | OTHER
- RequestStatus: PENDING | APPROVED | DENIED | CANCELLED

**ShiftSwap**
- id, date, shiftType, reason, status (enum), adminNote
- requesterId, targetId, organizationId
- SwapStatus: PENDING | ACCEPTED | DECLINED | APPROVED | CANCELLED

**StaffingRule**
- id, name, description, shiftType, minWorkers (int), maxVacation (int)
- role (optional), positionType (optional), priority (int 0-100), isActive (bool)
- organizationId, crewId (optional — crew-specific rules)
- Unique constraint: (organizationId, name)

**Holiday**
- id, name, date, isRecurring (bool), organizationId

**HolidayTracking**
- id, year, worked (bool), userId, holidayId

**Shutdown**
- id, name, startDate, endDate, description, organizationId

**Announcement**
- id, title, content (Text), priority: LOW | NORMAL | HIGH | URGENT, pinned (bool), expiresAt
- authorId, organizationId

**AuditLog**
- id, action, targetType, targetId, metadata (JSON), ipAddress
- userId, organizationId

**Notification**
- id, type (enum), title, message, data (JSON), read (bool)
- userId
- NotificationType: SCHEDULE_CHANGE | TIME_OFF_REQUEST | TIME_OFF_APPROVED | TIME_OFF_DENIED | STAFFING_ALERT | SHIFT_SWAP | SYSTEM

**AIChatSession**
- id, title, userId, organizationId
- Relations: messages (AIChatMessage[])

**AIChatMessage**
- id, role (string), content (Text), toolCalls (JSON), sessionId

**Invitation**
- id, email, role, token (unique), expiresAt
- organizationId, createdById

**Account / Session / VerificationToken** — Standard NextAuth models

---

## User Roles & Permissions

| Capability | ADMIN | SUPERVISOR | WORKER |
|---|---|---|---|
| View own schedule | Yes | Yes | Yes |
| Request time off | Yes | Yes | Yes |
| Request shift swap | Yes | Yes | Yes |
| QR check-in/out | Yes | Yes | Yes |
| Export personal calendar (iCal) | Yes | Yes | Yes |
| View announcements | Yes | Yes | Yes |
| Manage workers (add/edit/delete) | Yes | No | No |
| Manage crews | Yes | Yes | No |
| Generate schedules | Yes | Yes | No |
| Approve time-off requests | Yes | Yes | No |
| Approve shift swaps | Yes | Yes | No |
| Manage staffing rules | Yes | Yes | No |
| View reports & analytics | Yes | Yes | No |
| View audit log | Yes | Yes | No |
| Post announcements | Yes | Yes | No |
| Use AI assistant | Yes | Yes | No |
| Organization settings | Yes | No | No |
| Invite users | Yes | No | No |
| Data export (CSV) | Yes | No | No |
| Scan QR codes (attendance) | Yes | Yes | No |

---

## Pages & Routes

### Public Routes (no auth required)
- `/` — Landing page (marketing, redirects to /dashboard if logged in)
- `/login` — Sign in (email + password)
- `/register` — Account creation with plan selection (?plan=starter|professional)
- `/pricing` — Pricing page (3-tier cards)
- `/contact` — Contact page
- `/privacy` — Privacy policy
- `/terms` — Terms of service
- `/cookies` — Cookie policy
- `/api/auth/*` — NextAuth endpoints
- `/api/health` — Health check
- `/api/register` — Registration endpoint
- `/api/stripe/*` — Stripe checkout & webhooks

### Dashboard Routes (auth required)
All under `(dashboard)` layout with sidebar navigation:

- `/getting-started` — 6-step onboarding wizard (Create Crews → Add Workers → Shift Patterns → Generate Schedules → Staffing Alerts → Review)
- `/dashboard` — Overview with stats (On Duty, On Site, Workers, Requests), upcoming time-off, coverage gaps, personal schedule (14 days), quick actions
- `/schedule` — Full-year spreadsheet view, filter by crew, generate schedules from patterns, edit individual shifts or date ranges, custom shift types with color codes, schedule legend
- `/workers` — Workforce directory, add/edit/delete workers, search/filter by status/crew, role assignment, bulk import
- `/crews` — Crew management, color-coded, rotation pattern assignment, phase tracking, worker counts
- `/attendance` — Check-in/out tracking, daily attendance stats
- `/attendance/qr` — Personal QR code display for check-in
- `/attendance/scan` — QR scanner for supervisors/admins
- `/time-off` — Time-off request list, submit new requests, approve/deny (admin/supervisor), filter by status
- `/shift-swaps` — Shift swap requests, multi-step workflow (request → accept → approve), filter by type
- `/announcements` — Team announcements with priority levels (Low/Normal/High/Urgent), pinning, expiration
- `/reports` — Schedule statistics (shift distribution, utilization), workforce stats, crew summary, CSV export
- `/audit-log` — Action log with user attribution, filter by action type, pagination (50/page)
- `/assistant` — AI chat interface with conversation history, session management, suggested prompts
- `/settings` — Organization settings, schedule/display preferences, notifications, auto-checkout, holidays, rotation patterns, custom shift types, staffing rules, data export, account management

---

## API Routes

### Authentication
- `POST /api/register` — Create account (email, password, name, organizationName, plan)
- `GET/POST /api/auth/[...nextauth]` — NextAuth handlers
- `POST /api/auth/change-password` — Change password
- `DELETE /api/auth/delete-account` — Delete account

### Users
- `GET /api/users` — List users (org-scoped)
- `POST /api/users` — Create/invite user
- `GET /api/users/[id]` — Get user details
- `PUT /api/users/[id]` — Update user
- `DELETE /api/users/[id]` — Delete user

### Organization
- `GET /api/organization` — Get org details + settings
- `PATCH /api/organization` — Update org settings

### Crews
- `GET /api/crews` — List crews with worker counts
- `POST /api/crews` — Create crew
- `GET /api/crews/[id]` — Get crew details
- `PUT /api/crews/[id]` — Update crew
- `DELETE /api/crews/[id]` — Delete crew

### Schedules
- `GET /api/schedules` — Get schedules (filter by date range, crew, worker)
- `POST /api/schedules` — Generate schedules from rotation pattern
- `PUT /api/schedules` — Update/override individual schedule entries
- `DELETE /api/schedules` — Clear schedules (by crew, date range)

### Rotation Patterns
- `GET /api/rotation-patterns` — List patterns
- `POST /api/rotation-patterns` — Create pattern

### Attendance
- `GET /api/attendance` — Get attendance records
- `POST /api/attendance` — Check in
- `POST /api/attendance/check-out` — Check out
- `POST /api/attendance/auto-checkout` — Auto-checkout expired shifts

### Time Off
- `GET /api/time-off` — List requests (filter by status, worker)
- `POST /api/time-off` — Submit request or approve/deny

### Shift Swaps
- `GET /api/shift-swaps` — List swap requests
- `POST /api/shift-swaps` — Create swap request
- `GET /api/shift-swaps/[id]` — Get swap details
- `PUT /api/shift-swaps/[id]` — Update swap (accept/decline/approve/cancel)
- `DELETE /api/shift-swaps/[id]` — Delete swap

### Custom Shift Types
- `GET /api/custom-shift-types` — List custom types
- `POST /api/custom-shift-types` — Create type
- `PUT /api/custom-shift-types/[id]` — Update type
- `DELETE /api/custom-shift-types/[id]` — Delete type

### Staffing Rules
- `GET /api/staffing-rules` — List rules
- `POST /api/staffing-rules` — Create rule
- `PUT /api/staffing-rules/[id]` — Update rule
- `DELETE /api/staffing-rules/[id]` — Delete rule

### Holidays
- `GET /api/holidays` — List holidays
- `POST /api/holidays` — Create holiday
- `DELETE /api/holidays/[id]` — Delete holiday

### Announcements
- `GET /api/announcements` — List announcements
- `POST /api/announcements` — Create announcement (HTML sanitized, title max 200 chars, content max 5000 chars)
- `GET /api/announcements/[id]` — Get announcement
- `PUT /api/announcements/[id]` — Update announcement
- `DELETE /api/announcements/[id]` — Delete announcement

### Reports & Data
- `GET /api/dashboard` — Dashboard overview stats
- `GET /api/my-schedule` — Personal schedule (supports ?days=N)
- `GET /api/export` — CSV export (schedules, workers, or all)
- `GET /api/export/ical` — iCalendar export (.ics)
- `POST /api/import` — CSV import (workers)
- `GET /api/audit-log` — Audit log entries (paginated, filterable)
- `GET /api/notifications` — User notifications

### AI Assistant
- `POST /api/assistant` — Send message, receive AI response (with tool execution)
- `GET /api/assistant/sessions` — List chat sessions
- `POST /api/assistant/sessions` — Create session
- `GET /api/assistant/sessions/[id]` — Get session with messages
- `PUT /api/assistant/sessions/[id]` — Update session title
- `DELETE /api/assistant/sessions/[id]` — Delete session

### Payments
- `POST /api/stripe/checkout` — Create Stripe checkout session (14-day trial)
- `POST /api/stripe/webhook` — Handle subscription events (checkout.session.completed, customer.subscription.updated, customer.subscription.deleted)

### System
- `GET /api/health` — Health check
- `GET /api/setup-status` — Check if initial setup is done

---

## AI Assistant (Tool-Use Architecture)

The AI assistant uses the Anthropic SDK with 14 tools that can read and write to the database. It runs as a tool-use loop: Claude calls tools, the server executes them against Prisma, and returns results until Claude has a final text answer.

**Model:** claude-sonnet-4-20250514
**Max tokens:** 4096
**Message limit:** Last 10 messages (each truncated to 4000 chars)
**Access:** ADMIN and SUPERVISOR only

### Tools

| Tool | Type | Description |
|---|---|---|
| `get_schedules` | Read | Get schedules by date range, optional worker/crew filter |
| `update_schedule` | Write | Create or update a single shift for a worker on a date |
| `bulk_update_schedules` | Write | Update shifts for a date range (e.g., set a week to VACATION) |
| `get_workers` | Read | List workers, filter by name/crew/status |
| `get_worker_by_name` | Read | Find worker by partial name match (returns ID for use in other tools) |
| `update_worker` | Write | Update worker name, position, phone, crew, or status |
| `get_crews` | Read | List all crews with member counts |
| `get_time_off_requests` | Read | List time-off requests, filter by status/worker |
| `update_time_off_request` | Write | Approve or deny a request (auto-updates schedule if approved) |
| `get_today_summary` | Read | Today's day/night/off breakdown with worker names |
| `get_week_summary` | Read | Week staffing table (day/night/off counts per day), supports week offset |
| `swap_shifts` | Write | Swap shifts between two workers on specific dates |
| `get_staffing_rules` | Read | List active minimum staffing rules |
| `check_staffing_gaps` | Read | Compare actual schedules vs staffing rules, returns gap table |

### System Prompt Behavior
- Confirms before making multi-person or multi-date changes
- Uses `get_worker_by_name` to resolve names to IDs before modifying schedules
- Uses `check_staffing_gaps` (not manual counting) for coverage analysis
- Formats schedules and data clearly
- Organization-scoped — all queries filtered to current user's org

### Session Persistence
- Chat sessions stored in database (AIChatSession + AIChatMessage)
- Sessions titled from first message (50 char truncation)
- Full conversation history preserved
- Sessions can be listed, resumed, renamed, and deleted

---

## Onboarding Flow (Getting Started Wizard)

6-step wizard at `/getting-started`:

1. **Create Crews** — Name + color picker (8-color palette). Examples: Alpha, Bravo, Charlie, Delta
2. **Add Workers** — Name, email, position, crew assignment. Link to /workers for bulk management
3. **Shift Patterns** — Preset categories (Offshore/Equal Time: 7/7, 14/14, 21/21, 28/28; Short Rotation: 2/2, 3/3, 4/4; Standard: 5/2, 4/3, 6/1) or custom. Configurable: daysOn, daysOff, includesNights, nightDays, nightsAtStart, alternatesShifts
4. **Generate Schedules** — Select crew + pattern + start date + duration (3mo/6mo/1yr/2yr/3yr). Starting shift selector (DAY/NIGHT) for night-inclusive patterns
5. **Staffing Alerts** (optional) — Minimum workers per shift type and position. Quick presets: Min 3 Day/Night Operators, Min 1 Day/Night Control Room
6. **Review & Go** — Summary cards with green checkmarks (complete) or yellow warnings (incomplete). Links to jump back to incomplete steps. "Go to Dashboard" button

Progress bar shows completion percentage. Steps have numbered tabs with checkmarks.

---

## Schedule Generation Logic

When generating schedules from a rotation pattern:

1. Pattern defines: `daysOn`, `daysOff`, `includesNights`, `nightDays`, `nightsAtStart`, `alternatesShifts`
2. For each worker in the selected crew:
   - Start from the crew's `currentPhase` (offset into the pattern cycle)
   - For each day in the date range, assign shift type based on position in the cycle:
     - Days 1 to daysOn: work days (DAY or NIGHT based on night config)
     - Days daysOn+1 to daysOn+daysOff: OFF
   - Night shift placement depends on `nightsAtStart` (beginning or end of work block) and `nightDays` count
   - `alternatesShifts` creates Day→Night→Day alternation across rotations
3. Schedules are created as individual `Schedule` records (userId + date + shiftType)
4. Manual overrides are tracked with `isOverride` flag and `overrideReason`

---

## Stripe Integration

### Plans
- **Starter:** $49/mo — Up to 25 workers, 4 crews, basic rotation patterns, time-off management, email support
- **Professional:** $149/mo — Up to 100 workers, unlimited crews, custom rotation patterns, AI assistant, advanced reporting, staffing rules, audit log, priority support
- **Enterprise:** Custom — Unlimited workers, API access, custom integrations, SSO/SAML, dedicated account manager, SLA guarantee

### Flow
1. User selects plan on `/pricing` or `/register?plan=<plan>`
2. Registration creates account + organization
3. If `NEXT_PUBLIC_STRIPE_ENABLED=true`, redirects to Stripe Checkout with 14-day trial
4. Webhook handles: `checkout.session.completed` (stores plan + subscription in org settings), `customer.subscription.updated` (plan changes), `customer.subscription.deleted` (cancellation)

---

## Settings (Organization Configuration)

Single page with card-based sections:

- **Organization** — Name, worker/crew/pattern counts, invite users
- **Schedule & Display** — Timezone (11 options), date format (4 options), week start (Sun/Mon), theme (Light/Dark/System)
- **Notifications** — Email toggle, SMS toggle, staffing alerts toggle
- **Auto-Checkout** — Enable/disable, shift duration (8 or 12 hours)
- **Holidays** — Add/delete company holidays, recurring yearly option
- **Rotation Patterns** — View/create/edit patterns, mark default, track crew usage
- **Custom Shift Types** — Define shift codes, names, colors, descriptions, active/inactive
- **Staffing Rules** — Add/edit/delete rules. Fields: name, shift type, min workers, max vacation, position type, crew, priority (0-100), active toggle
- **Data Export** — CSV export for schedules, workers, or all data
- **Account** — View profile (name, email, role, org), change password, delete account

---

## Middleware Configuration

**Auth:** NextAuth `withAuth` middleware with JWT

**Public paths:** `/login`, `/register`, `/pricing`, `/contact`, `/terms`, `/privacy`, `/cookies`, `/api/auth`, `/api/health`, `/api/register`, `/api/stripe`

**CSRF:** Origin verification on POST/PUT/PATCH/DELETE (exempts `/api/stripe/webhook`)

**Security headers:** HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP (production only)

**Matcher:** All paths except `_next/static`, `_next/image`, `favicon.ico`, `public/`

---

## Environment Variables

```
# Database (Railway PostgreSQL)
DATABASE_URL=
DIRECT_URL=

# Auth
NEXTAUTH_URL=https://your-app.up.railway.app
NEXTAUTH_SECRET=           # openssl rand -base64 32

# Admin (disabled in production)
CRON_SECRET=

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Error Monitoring (Sentry)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Payments (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_ENABLED=true
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=

# AI Assistant (Anthropic)
ANTHROPIC_API_KEY=

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=

# OAuth (Google — optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Testing

- **Framework:** Vitest with `@vitejs/plugin-react`
- **Path alias:** `@` → `src/`
- **Test files:**
  - `src/lib/__tests__/rate-limit.test.ts` — 8 tests (rate limit logic, IP extraction, Redis fallback)
  - `src/lib/__tests__/validations.test.ts` — 25 tests (Zod schema validation for all input types)
- **Total:** 33 tests

---

## File Structure Overview

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + header layout
│   │   ├── dashboard/page.tsx
│   │   ├── schedule/page.tsx
│   │   ├── workers/page.tsx
│   │   ├── crews/page.tsx
│   │   ├── attendance/page.tsx
│   │   ├── attendance/qr/page.tsx
│   │   ├── attendance/scan/page.tsx
│   │   ├── time-off/page.tsx
│   │   ├── shift-swaps/page.tsx
│   │   ├── announcements/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── audit-log/page.tsx
│   │   ├── assistant/page.tsx
│   │   ├── settings/page.tsx
│   │   └── getting-started/page.tsx
│   ├── (legal)/
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── cookies/page.tsx
│   │   └── contact/page.tsx
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   └── pricing/
│   │       ├── page.tsx
│   │       └── pricing-cards.tsx
│   ├── api/
│   │   ├── assistant/
│   │   ├── attendance/
│   │   ├── audit-log/
│   │   ├── auth/
│   │   ├── crews/
│   │   ├── custom-shift-types/
│   │   ├── dashboard/
│   │   ├── export/
│   │   ├── health/
│   │   ├── holidays/
│   │   ├── import/
│   │   ├── migrate/
│   │   ├── my-schedule/
│   │   ├── notifications/
│   │   ├── organization/
│   │   ├── register/
│   │   ├── rotation-patterns/
│   │   ├── schedules/
│   │   ├── setup/
│   │   ├── setup-status/
│   │   ├── shift-swaps/
│   │   ├── staffing-rules/
│   │   ├── stripe/
│   │   ├── time-off/
│   │   └── users/
│   ├── globals.css
│   ├── layout.tsx                  # Root layout, metadata, JSON-LD
│   └── page.tsx                    # Landing page
├── components/
│   ├── layout/
│   │   ├── header.tsx              # Dashboard header with bell icon
│   │   ├── sidebar.tsx             # Dashboard sidebar navigation
│   │   └── footer.tsx              # Marketing footer
│   ├── providers.tsx               # Theme + session + React Query + cookie consent
│   ├── cookie-consent.tsx          # GDPR cookie banner
│   └── ui/                         # Reusable UI components (Button, Card, Input, etc.)
├── lib/
│   ├── auth.ts                     # NextAuth config
│   ├── prisma.ts                   # Prisma client singleton
│   ├── stripe.ts                   # Stripe config + PLANS
│   ├── rate-limit.ts               # Redis + in-memory rate limiter
│   ├── navigation.ts               # Sidebar nav items config
│   ├── utils.ts                    # cn() helper
│   └── __tests__/                  # Vitest tests
├── middleware.ts                    # Auth + CSRF + security headers
└── types/
    └── index.ts                    # Shared TypeScript types
```

---

## Key Workflows

### Schedule Generation
User → Select crew → Select rotation pattern → Set start date + duration → Click Generate → System creates Schedule records for every worker in crew for the date range based on pattern rules → Schedule calendar updates

### Time-Off Request
Worker → Submit request (type, dates, reason) → Status: PENDING → Supervisor/Admin approves or denies → If approved, schedule entries auto-updated to LEAVE/VACATION → Worker notified

### Shift Swap
Worker A → Creates swap request (target worker, date, shift type, reason) → Status: PENDING → Worker B accepts → Status: ACCEPTED → Supervisor/Admin approves → Status: APPROVED → Schedules swapped

### QR Attendance
Worker → Opens /attendance/qr → Shows personal QR code → Supervisor scans via /attendance/scan → Check-in recorded with timestamp and scannedBy → Auto-checkout available after configured hours (8 or 12)

### AI Assistant
User → Types natural language query → API sends to Claude with 14 tools → Claude calls tools (e.g., get_worker_by_name, then get_schedules) → Server executes against Prisma → Results returned to Claude → Claude generates final response → Chat saved to session

---

## Landing Page Structure

Conversion-focused sales page with 11 sections:

1. **Sticky header** — Logo, nav links (Features, How It Works, Pricing), Sign In + Start Free Trial
2. **Hero** — Split layout: problem headline ("Stop wrestling with shift schedules") + dashboard mockup with metric cards, schedule grid, floating notification cards
3. **Pain points** — "Sound familiar?" — 4 cards: spreadsheet chaos, staffing gaps, manual tracking, request bottlenecks
4. **Feature deep dive: Rotation Engine** — 14-day schedule mockup with 6 workers across 3 crews, bullet points
5. **Feature deep dive: Time-Off & Swaps** — Stacked UI mockups showing approval queue + shift swap card
6. **Feature deep dive: AI Assistant** — Chat conversation mockup with structured data response
7. **Feature grid** — 9 cards: QR attendance, staffing rules, reports, announcements, audit log, RBAC, calendar export, crew management, custom shift types
8. **How It Works** — 4 steps with dashed connectors: Create org → Add crews → Generate schedules → Go live
9. **Testimonials + stats** — 3 customer quotes with star ratings + 4 stat badges (500+ teams, 12K+ workers, 99.9% uptime, 4.8/5)
10. **Pricing** — 3-tier cards ($49/$149/Custom) with feature lists
11. **CTA** — "Your crew deserves better than a spreadsheet" with trial + sales buttons

---

## Pricing (Stripe)

| Feature | Starter ($49/mo) | Professional ($149/mo) | Enterprise (Custom) |
|---|---|---|---|
| Workers | Up to 25 | Up to 100 | Unlimited |
| Crews | 4 | Unlimited | Unlimited |
| Rotation patterns | Basic | Custom | Custom |
| Schedule generation | Yes | Yes | Yes |
| Time-off management | Yes | Yes | Yes |
| Shift swaps | Yes | Yes | Yes |
| QR attendance | Yes | Yes | Yes |
| Announcements | Yes | Yes | Yes |
| AI assistant | — | Yes | Yes |
| Advanced reporting | — | Yes | Yes |
| Staffing rules engine | — | Yes | Yes |
| Audit log | — | Yes | Yes |
| CSV export | — | Yes | Yes |
| API access | — | — | Yes |
| Custom integrations | — | — | Yes |
| SSO / SAML | — | — | Yes |
| Dedicated account manager | — | — | Yes |
| SLA guarantee | — | — | Yes |
| Support | Email | Priority | Dedicated |

All plans include 14-day free trial. No credit card required to start.

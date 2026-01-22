# ShiftSync

AI-Powered Workforce Scheduling Platform

## Overview

ShiftSync is a comprehensive workforce scheduling platform designed for industries with complex rotating shift patterns, including offshore oil and gas, manufacturing, healthcare, and construction.

## Features

- **Flexible Rotation Templates**: Support for 2 on/2 off, 3 on/3 off, 14 on/14 off, and custom patterns
- **Crew-Based Scheduling**: Manage Crews A, B, C, D with synchronized rotations
- **Day/Night Rotation Handling**: Automatic transitions between day and night shifts
- **Full-Year Calendar View**: Cross-year continuity with spreadsheet-style overview
- **Staffing Rules & Alerts**: Configurable minimum staffing with red flag alerts
- **Time Off Management**: Vacation requests with staffing impact checks
- **Holiday Fairness Tracking**: Automated holiday rotation tracking

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Hosting**: Railway

## Deploy to Railway

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/shiftsync)

### Manual Deployment

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Create a new project** and add a PostgreSQL database:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub repository
   - Railway will auto-detect Next.js

3. **Add PostgreSQL**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Set environment variables** in Railway dashboard:
   ```
   NEXTAUTH_URL=https://your-app.up.railway.app
   NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
   DIRECT_URL=${{Postgres.DATABASE_URL}}
   ```

5. **Run database migrations** (in Railway shell or locally):
   ```bash
   npx prisma db push
   ```

6. **Seed database** (creates organization, crews, rotation patterns):
   ```bash
   npm run db:seed
   ```
   
   To create demo users (optional), set environment variables:
   ```bash
   SEED_DEMO=true SEED_DEMO_PASSWORD=yourpassword npm run db:seed
   ```

7. **Create an admin user** - See "Creating Admin Users" section below for options.

### Railway Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection (auto-set by Railway) | Yes |
| `DIRECT_URL` | Direct DB connection for migrations | Yes |
| `NEXTAUTH_URL` | Your Railway app URL | Yes |
| `NEXTAUTH_SECRET` | Random 32-byte secret | Yes |

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use Railway's)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd shiftsync
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Push database schema:
```bash
npm run db:push
```

5. Seed database (creates organization, crews, rotation patterns):
```bash
npm run db:seed
```

6. Create an admin user (see "Creating Admin Users" below)

7. Start development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Creating Admin Users

For local development, you have several options to create an admin user:

**Option 1: Using Prisma Studio (Recommended)**
```bash
npx prisma studio
```
Then create a user with role "ADMIN" and a bcrypt-hashed password.

**Option 2: Opt-in Demo Seeding**
```bash
SEED_DEMO=true SEED_DEMO_PASSWORD=yourpassword npm run db:seed
```
This creates a demo admin (admin@local) and minimal demo workers with your chosen password.

**Option 3: Manual Script**
```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const passwordHash = await bcrypt.hash("yourpassword", 12)

await prisma.user.create({
  data: {
    email: "admin@yourdomain.com",
    name: "Admin User",
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "your-org-id",
  },
})
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── layout/           # Layout components
├── lib/                   # Utility functions
│   ├── auth.ts           # Authentication config
│   ├── prisma.ts         # Database client
│   ├── scheduling.ts     # Schedule generation
│   └── validations.ts    # Zod schemas
└── types/                 # TypeScript types
```

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/register` | POST | User registration |
| `/api/auth/[...nextauth]` | * | Authentication |
| `/api/users` | GET, POST | User management |
| `/api/crews` | GET, POST | Crew management |
| `/api/schedules` | GET, POST | Schedule operations |
| `/api/time-off` | GET, POST, PATCH | Time off requests |
| `/api/rotation-patterns` | GET, POST | Rotation patterns |
| `/api/organization` | GET, PATCH | Organization settings |
| `/api/dashboard` | GET | Dashboard statistics |
| `/api/health` | GET | Health check |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:seed      # Seed demo data
```

## License

Proprietary - All rights reserved


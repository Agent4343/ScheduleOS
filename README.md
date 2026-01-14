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

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

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
# Edit .env with your database and authentication settings
```

4. Generate Prisma client and run migrations:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

- `POST /api/register` - User registration
- `POST /api/auth/[...nextauth]` - Authentication
- `GET/POST /api/users` - User management
- `GET/POST /api/crews` - Crew management
- `GET/POST /api/schedules` - Schedule operations
- `GET/POST /api/time-off` - Time off requests
- `GET/PATCH /api/organization` - Organization settings
- `GET /api/dashboard` - Dashboard statistics

## License

Proprietary - All rights reserved

# ShiftSync

**The Universal Workforce Scheduling Platform**

ShiftSync is an intelligent scheduling solution designed to handle the complexity of rotating shift work across any industry—from oil rigs and manufacturing plants to healthcare and emergency services. It automates the tedious parts of scheduling so supervisors can focus on production and operations.

## Why Supervisors Love ShiftSync

### ⏱️ Saves Hours of Planning Time
- **One-Click Generation**: Select a start date and pattern, and generate schedules for 5 years in seconds.
- **Automated Rotations**: No more manual spreadsheet copying. The system handles 2/2, 14/14, day/night swaps, and complex custom patterns automatically.
- **Visual Calendar**: See the whole year or just this month at a glance with clear, color-coded shifts.

### 🏭 Built for Any Industry
- **Universal Flexibility**: Whether you work 12-hour shifts on an oil rig, 8-hour rotations in a factory, or 24-hour emergency crew cycles, ShiftSync adapts.
- **Custom Shift Types**: Create your own shift codes (e.g., "TRAINING", "ON-CALL", "OFFSHORE") to match your industry's language.
- **Staffing Rules**: Define minimum staffing levels (e.g., "Night shift needs 2 Operators"). The system automatically flags gaps so you never run understaffed.

### 🧠 Smarter Management
- **Instant Notifications**: Get alerted immediately when schedules change or staffing drops below safe levels.
- **Crew Management**: Organize workers into Crews (A, B, C, D) and manage them as a unit.
- **Time Off Tracking**: Workers request leave, you approve it, and the schedule updates automatically—checking for conflicts instantly.

## Key Features

- **Flexible Rotation Templates**: Support for 2 on/2 off, 3 on/3 off, 14 on/14 off, and completely custom patterns.
- **Staffing Rules Engine**: Set rules like "Must have 1 Supervisor on Day Shift" and get alerts when rules are broken.
- **Month & Year Views**: Toggle between high-level year planning and detailed monthly execution.
- **Notifications System**: Built-in alerts for time-off requests, approvals, and staffing warnings.
- **Export & Reporting**: Download schedules and worker reports for offline use or compliance.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **Testing**: Vitest for reliable logic

## Getting Started

### Deploy to Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/shiftsync)

### Local Development

1. **Clone & Install**:
   ```bash
   git clone <repository-url>
   cd shiftsync
   npm install
   ```

2. **Setup Database**:
   ```bash
   # Copy env file
   cp .env.example .env
   # Add your database URL to .env
   
   # Push schema
   npm run db:push
   
   # Seed default patterns
   npm run db:seed
   ```

3. **Run**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Run Tests**:
   ```bash
   npm test
   ```

## License

Proprietary - All rights reserved

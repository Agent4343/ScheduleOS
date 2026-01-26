# ShiftSync: The Ultimate Workforce Scheduling Platform

**ShiftSync** is a powerful, industry-agnostic scheduling engine designed to automate complex shift rotations. It replaces spreadsheets with intelligent automation, ensuring compliance, safety, and efficiency for workforces in oil & gas, manufacturing, healthcare, and beyond.

---

## 🚀 Key Capabilities (What it Does)

### 1. **Automated Schedule Generation**
*   **The Problem:** Manually filling out a calendar for 50+ workers on different rotations (14/14, 2/2, 3/3) takes hours and leads to errors.
*   **The ShiftSync Solution:**
    *   **One-Click Generation:** Select a worker, choose a pattern (e.g., "14 Days On / 14 Days Off"), pick a start date, and the system instantly fills the calendar for 5 years.
    *   **Smart Rotations:** Automatically handles complex logic like switching between Day and Night shifts mid-rotation or alternating every cycle.

### 2. **Staffing Compliance & Safety**
*   **The Problem:** Running a shift understaffed (e.g., "Night Shift has 0 Operators") is a safety risk and compliance violation.
*   **The ShiftSync Solution:**
    *   **Real-Time Validation:** Every time you edit the schedule, the system checks your **Staffing Rules**.
    *   **Visual Alerts:** If you remove a worker and leave a shift short-handed, you get an immediate warning: *"Leaving Night Shift understaffed (Min: 2 Operators)."*
    *   **Daily Summaries:** The schedule view shows a live count of Operators and Control Room staff for every single day. If numbers drop below safe levels, they turn **RED**.

### 3. **Intelligent Role Tracking**
*   **The Problem:** Workers have different titles ("Ops A", "Tech", "Lead"), making it hard to count "How many *Operators* do I have?"
*   **The ShiftSync Solution:**
    *   **Smart Matching:** The system intelligently categorizes workers into roles (Operator vs. Control Room) by analyzing their:
        *   **Position Type:** (Database Code)
        *   **Job Title:** (e.g., "Ops Tech", "Production Lead")
        *   **Crew Name:** (e.g., "Onshore Control Room Shift A")
    *   This ensures 100% accurate staffing counts even if data is messy.

### 4. **Visual Management**
*   **The Problem:** Spreadsheets are cluttered and hard to read on mobile or print.
*   **The ShiftSync Solution:**
    *   **Paint Mode:** Rapidly assign shifts by clicking and dragging across the calendar (like painting cells in Excel).
    *   **Print View:** A clean, stripped-down view optimized for printing daily schedules for the bulletin board.
    *   **Year vs. Month:** Toggle between a high-level annual view and a detailed monthly execution view.

---

## 🛠️ Configuration Guide (What You Can Change)

### **1. Rotation Patterns (`/settings`)**
*   **What it is:** The blueprints for your shifts.
*   **How to change:** Go to **Settings > Rotation Patterns**.
*   **Examples:**
    *   *Standard:* 14 Days On, 14 Days Off.
    *   *Alternating:* 2 Days / 2 Nights / 4 Off.
    *   *Custom:* Create any sequence you need.

### **2. Staffing Rules (`/settings`)**
*   **What it is:** The safety limits for your workforce.
*   **How to change:** Go to **Settings > Staffing Rules**.
*   **Actions:**
    *   Set **Minimum Workers** for specific roles (e.g., "Must have 2 Operators on Night Shift").
    *   Define which roles (Operator, Control Room, Other) the rule applies to.

### **3. Custom Shift Types (`/settings`)**
*   **What it is:** The codes you see on the calendar.
*   **How to change:** Go to **Settings > Custom Shift Types**.
*   **Actions:**
    *   Create codes like **TRN** (Training), **MED** (Medical), **OFFSHORE**.
    *   Assign custom colors (e.g., Purple for Training) for instant visual recognition.

### **4. Workers & Crews (`/workers`, `/crews`)**
*   **What it is:** Your people and teams.
*   **How to change:**
    *   **Workers:** Add/Edit users, assign them to Crews, and set their Job Titles. *Note: Job Titles containing "Ops", "Tech", or "Control" automatically trigger staffing logic.*
    *   **Crews:** Group workers (e.g., "Crew A", "OCR Shift B") to filter the schedule view.

---

## 💻 Technical Overview (For Developers)

### **Stack**
*   **Framework:** Next.js 14 (App Router)
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Auth:** NextAuth.js
*   **State:** React Query (TanStack)
*   **Testing:** Vitest

### **Key Logic Files**
*   `src/lib/scheduling.ts`: Core algorithm for generating future dates based on rotation patterns.
*   `src/app/(dashboard)/schedule/page.tsx`: The heavy lifter. Contains the calendar grid, **Paint Mode** logic, and **Staffing Compliance** calculations.
*   `src/components/settings/staffing-rules-card.tsx`: UI for configuring safety rules.

### **API Routes**
*   `POST /api/schedules`: Generates or updates shifts. Handles transactions for bulk updates.
*   `GET /api/reports`: Aggregates data for the compliance dashboard.

---

## 🚀 Getting Started

1.  **Deploy:** Click the Railway button in the main repo to launch your own instance.
2.  **Seed:** Use `npm run db:seed` to populate default patterns (2/2, 14/14, etc.).
3.  **Configure:** Log in as Admin, go to **Settings**, and define your **Staffing Rules**.
4.  **Schedule:** Go to **Schedule**, select a worker, and click **Generate**.

---

**ShiftSync** transforms scheduling from a chore into a strategic advantage.

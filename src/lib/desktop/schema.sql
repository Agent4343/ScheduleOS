-- ScheduleOS SQLite Schema
-- Mirrors the PostgreSQL Prisma schema for offline desktop use

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =====================
-- Core Tables
-- =====================

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    stripe_customer_id TEXT UNIQUE,
    stripe_price_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    plan TEXT DEFAULT 'FREE',
    plan_period_end TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    email_verified TEXT,
    name TEXT,
    password_hash TEXT,
    image TEXT,
    role TEXT DEFAULT 'WORKER',
    position TEXT,
    phone TEXT,
    hire_date TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    rotation_group TEXT,
    primary_position TEXT,
    qualifications TEXT DEFAULT '[]',
    is_ccr_qualified INTEGER DEFAULT 0,
    is_ps_capable INTEGER DEFAULT 0,
    is_pl_capable INTEGER DEFAULT 0,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    crew_id TEXT REFERENCES crews(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crews (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    current_phase INTEGER DEFAULT 0,
    alternates_day_night INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rotation_pattern_id TEXT REFERENCES rotation_patterns(id),
    UNIQUE(organization_id, name),
    UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS rotation_patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    days_on INTEGER NOT NULL,
    days_off INTEGER NOT NULL,
    includes_nights INTEGER DEFAULT 0,
    nights_at_start INTEGER DEFAULT 1,
    night_days INTEGER DEFAULT 0,
    pattern_definition TEXT DEFAULT '[]',
    is_default INTEGER DEFAULT 0,
    alternates_day_night INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT,
    shift_type TEXT NOT NULL,
    min_staffing INTEGER DEFAULT 1,
    max_staffing INTEGER DEFAULT 1,
    required_qualifications TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, name)
);

-- =====================
-- Scheduling Tables
-- =====================

CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    is_override INTEGER DEFAULT 0,
    override_reason TEXT,
    notes TEXT,
    is_backfill INTEGER DEFAULT 0,
    backfill_role TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    crew_id TEXT REFERENCES crews(id),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_crew_date ON schedules(crew_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_shift_type_date ON schedules(shift_type, date);

CREATE TABLE IF NOT EXISTS time_off_requests (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    reason TEXT,
    notes TEXT,
    admin_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approved_by_id TEXT REFERENCES users(id),
    approved_at TEXT
);

-- =====================
-- Staffing Rules & Alerts
-- =====================

CREATE TABLE IF NOT EXISTS staffing_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    min_workers INTEGER NOT NULL,
    max_vacation INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS shutdowns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- =====================
-- Holiday Tracking
-- =====================

CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    is_recurring INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, name, date)
);

CREATE TABLE IF NOT EXISTS holiday_tracking (
    id TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    worked INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    holiday_id TEXT NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
    UNIQUE(user_id, holiday_id, year)
);

-- =====================
-- Notifications
-- =====================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- =====================
-- Shift Type Configuration
-- =====================

CREATE TABLE IF NOT EXISTS shift_type_configs (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    category TEXT NOT NULL,
    bg_color TEXT DEFAULT 'bg-gray-500',
    text_color TEXT DEFAULT 'text-white',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id, code)
);

-- =====================
-- Sync Tracking
-- =====================

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    data TEXT,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_unsynced ON sync_log(synced) WHERE synced = 0;

CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_at TEXT,
    last_sync_status TEXT,
    pending_changes INTEGER DEFAULT 0
);

-- Initialize sync status
INSERT OR IGNORE INTO sync_status (id, pending_changes) VALUES (1, 0);

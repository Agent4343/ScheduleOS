/**
 * ScheduleOS Offline Database Layer
 * Provides SQLite operations for desktop (Tauri) mode
 */

// Types matching Prisma schema
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'SUPERVISOR' | 'WORKER';
  position: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  rotationGroup: string | null;
  primaryPosition: string | null;
  isCCRQualified: boolean;
  isPSCapable: boolean;
  isPLCapable: boolean;
  organizationId: string | null;
  crewId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Crew {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  currentPhase: number;
  alternatesDayNight: boolean;
  organizationId: string;
  rotationPatternId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  date: string;
  shiftType: string;
  isOverride: boolean;
  overrideReason: string | null;
  notes: string | null;
  isBackfill: boolean;
  backfillRole: string | null;
  userId: string;
  crewId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  shiftType: string;
  minStaffing: number;
  maxStaffing: number;
  requiredQualifications: string[];
  sortOrder: number;
  organizationId: string;
}

export interface RotationPattern {
  id: string;
  name: string;
  description: string | null;
  daysOn: number;
  daysOff: number;
  includesNights: boolean;
  nightsAtStart: boolean;
  nightDays: number;
  alternatesDayNight: boolean;
  organizationId: string;
}

export interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  reason: string | null;
  notes: string | null;
  userId: string;
  approvedById: string | null;
  approvedAt: string | null;
}

// Check if running in Tauri desktop environment
export function isDesktopMode(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
}

// Dynamic import for Tauri SQL plugin (only available in desktop mode)
let db: unknown = null;

async function getDatabase() {
  if (!isDesktopMode()) {
    throw new Error('Offline database is only available in desktop mode');
  }

  if (db) return db;

  // Dynamic import of Tauri SQL plugin
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  db = await Database.load('sqlite:scheduleos.db');
  return db;
}

// Initialize database with schema
export async function initializeDatabase(): Promise<void> {
  if (!isDesktopMode()) return;

  // Initialize database connection - tables are created automatically
  await getDatabase();
  console.log('ScheduleOS offline database initialized');
}

// =====================
// User Operations
// =====================

export async function getUsers(organizationId: string): Promise<User[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    position: string | null;
    status: string;
    rotation_group: string | null;
    primary_position: string | null;
    is_ccr_qualified: number;
    is_ps_capable: number;
    is_pl_capable: number;
    organization_id: string | null;
    crew_id: string | null;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT * FROM users WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as User['role'],
    position: row.position,
    status: row.status as User['status'],
    rotationGroup: row.rotation_group,
    primaryPosition: row.primary_position,
    isCCRQualified: row.is_ccr_qualified === 1,
    isPSCapable: row.is_ps_capable === 1,
    isPLCapable: row.is_pl_capable === 1,
    organizationId: row.organization_id,
    crewId: row.crew_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getUserById(id: string): Promise<User | null> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    position: string | null;
    status: string;
    rotation_group: string | null;
    primary_position: string | null;
    is_ccr_qualified: number;
    is_ps_capable: number;
    is_pl_capable: number;
    organization_id: string | null;
    crew_id: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM users WHERE id = ?', [id]);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as User['role'],
    position: row.position,
    status: row.status as User['status'],
    rotationGroup: row.rotation_group,
    primaryPosition: row.primary_position,
    isCCRQualified: row.is_ccr_qualified === 1,
    isPSCapable: row.is_ps_capable === 1,
    isPLCapable: row.is_pl_capable === 1,
    organizationId: row.organization_id,
    crewId: row.crew_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =====================
// Schedule Operations
// =====================

export async function getSchedules(
  startDate: string,
  endDate: string,
  organizationId: string
): Promise<(Schedule & { user: User })[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    id: string;
    date: string;
    shift_type: string;
    is_override: number;
    override_reason: string | null;
    notes: string | null;
    is_backfill: number;
    backfill_role: string | null;
    user_id: string;
    crew_id: string | null;
    created_at: string;
    updated_at: string;
    user_email: string;
    user_name: string | null;
    user_role: string;
    user_position: string | null;
    user_status: string;
    user_rotation_group: string | null;
    user_primary_position: string | null;
    user_is_ccr_qualified: number;
    user_is_ps_capable: number;
    user_is_pl_capable: number;
  }>(
    `SELECT
      s.*,
      u.email as user_email,
      u.name as user_name,
      u.role as user_role,
      u.position as user_position,
      u.status as user_status,
      u.rotation_group as user_rotation_group,
      u.primary_position as user_primary_position,
      u.is_ccr_qualified as user_is_ccr_qualified,
      u.is_ps_capable as user_is_ps_capable,
      u.is_pl_capable as user_is_pl_capable
    FROM schedules s
    JOIN users u ON s.user_id = u.id
    WHERE s.date >= ? AND s.date <= ? AND u.organization_id = ?
    ORDER BY s.date, u.name`,
    [startDate, endDate, organizationId]
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    shiftType: row.shift_type,
    isOverride: row.is_override === 1,
    overrideReason: row.override_reason,
    notes: row.notes,
    isBackfill: row.is_backfill === 1,
    backfillRole: row.backfill_role,
    userId: row.user_id,
    crewId: row.crew_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      email: row.user_email,
      name: row.user_name,
      role: row.user_role as User['role'],
      position: row.user_position,
      status: row.user_status as User['status'],
      rotationGroup: row.user_rotation_group,
      primaryPosition: row.user_primary_position,
      isCCRQualified: row.user_is_ccr_qualified === 1,
      isPSCapable: row.user_is_ps_capable === 1,
      isPLCapable: row.user_is_pl_capable === 1,
      organizationId: organizationId,
      crewId: row.crew_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  }));
}

export async function upsertSchedule(schedule: Partial<Schedule>): Promise<void> {
  const database = await getDatabase() as {
    execute: (query: string, params?: unknown[]) => Promise<{ rowsAffected: number }>;
  };

  const now = new Date().toISOString();
  const id = schedule.id || crypto.randomUUID();

  await database.execute(
    `INSERT INTO schedules (id, date, shift_type, is_override, override_reason, notes, is_backfill, backfill_role, user_id, crew_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       shift_type = excluded.shift_type,
       is_override = excluded.is_override,
       override_reason = excluded.override_reason,
       notes = excluded.notes,
       is_backfill = excluded.is_backfill,
       backfill_role = excluded.backfill_role,
       crew_id = excluded.crew_id,
       updated_at = excluded.updated_at`,
    [
      id,
      schedule.date,
      schedule.shiftType,
      schedule.isOverride ? 1 : 0,
      schedule.overrideReason || null,
      schedule.notes || null,
      schedule.isBackfill ? 1 : 0,
      schedule.backfillRole || null,
      schedule.userId,
      schedule.crewId || null,
      now,
      now,
    ]
  );

  // Log for sync
  await logSyncAction('schedules', id, schedule.id ? 'UPDATE' : 'INSERT', schedule);
}

export async function deleteSchedule(userId: string, date: string): Promise<void> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
    execute: (query: string, params?: unknown[]) => Promise<{ rowsAffected: number }>;
  };

  // Get the schedule ID first
  const rows = await database.select<{ id: string }>(
    'SELECT id FROM schedules WHERE user_id = ? AND date = ?',
    [userId, date]
  );

  if (rows.length > 0) {
    const scheduleId = rows[0].id;

    await database.execute(
      'DELETE FROM schedules WHERE user_id = ? AND date = ?',
      [userId, date]
    );

    // Log for sync
    await logSyncAction('schedules', scheduleId, 'DELETE', { userId, date });
  }
}

// =====================
// Crew Operations
// =====================

export async function getCrews(organizationId: string): Promise<Crew[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    color: string;
    current_phase: number;
    alternates_day_night: number;
    organization_id: string;
    rotation_pattern_id: string | null;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT * FROM crews WHERE organization_id = ? ORDER BY name',
    [organizationId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    color: row.color,
    currentPhase: row.current_phase,
    alternatesDayNight: row.alternates_day_night === 1,
    organizationId: row.organization_id,
    rotationPatternId: row.rotation_pattern_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// =====================
// Position Operations
// =====================

export async function getPositions(organizationId: string): Promise<Position[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    id: string;
    name: string;
    code: string | null;
    category: string | null;
    shift_type: string;
    min_staffing: number;
    max_staffing: number;
    required_qualifications: string;
    sort_order: number;
    organization_id: string;
  }>(
    'SELECT * FROM positions WHERE organization_id = ? ORDER BY sort_order, name',
    [organizationId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category,
    shiftType: row.shift_type,
    minStaffing: row.min_staffing,
    maxStaffing: row.max_staffing,
    requiredQualifications: JSON.parse(row.required_qualifications || '[]'),
    sortOrder: row.sort_order,
    organizationId: row.organization_id,
  }));
}

// =====================
// Time Off Request Operations
// =====================

export async function getTimeOffRequests(
  organizationId: string,
  status?: string
): Promise<(TimeOffRequest & { user: User })[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  let query = `
    SELECT
      t.*,
      u.email as user_email,
      u.name as user_name,
      u.role as user_role,
      u.position as user_position,
      u.status as user_status
    FROM time_off_requests t
    JOIN users u ON t.user_id = u.id
    WHERE u.organization_id = ?
  `;

  const params: unknown[] = [organizationId];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  query += ' ORDER BY t.created_at DESC';

  const rows = await database.select<{
    id: string;
    start_date: string;
    end_date: string;
    type: string;
    status: string;
    reason: string | null;
    notes: string | null;
    user_id: string;
    approved_by_id: string | null;
    approved_at: string | null;
    user_email: string;
    user_name: string | null;
    user_role: string;
    user_position: string | null;
    user_status: string;
  }>(query, params);

  return rows.map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    type: row.type,
    status: row.status as TimeOffRequest['status'],
    reason: row.reason,
    notes: row.notes,
    userId: row.user_id,
    approvedById: row.approved_by_id,
    approvedAt: row.approved_at,
    user: {
      id: row.user_id,
      email: row.user_email,
      name: row.user_name,
      role: row.user_role as User['role'],
      position: row.user_position,
      status: row.user_status as User['status'],
      rotationGroup: null,
      primaryPosition: null,
      isCCRQualified: false,
      isPSCapable: false,
      isPLCapable: false,
      organizationId,
      crewId: null,
      createdAt: '',
      updatedAt: '',
    },
  }));
}

export async function updateTimeOffRequestStatus(
  id: string,
  status: 'APPROVED' | 'DENIED',
  approvedById: string
): Promise<void> {
  const database = await getDatabase() as {
    execute: (query: string, params?: unknown[]) => Promise<{ rowsAffected: number }>;
  };

  const now = new Date().toISOString();

  await database.execute(
    `UPDATE time_off_requests
     SET status = ?, approved_by_id = ?, approved_at = ?, updated_at = ?
     WHERE id = ?`,
    [status, approvedById, now, now, id]
  );

  // Log for sync
  await logSyncAction('time_off_requests', id, 'UPDATE', { status, approvedById });
}

// =====================
// Sync Operations
// =====================

async function logSyncAction(
  tableName: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  data: unknown
): Promise<void> {
  const database = await getDatabase() as {
    execute: (query: string, params?: unknown[]) => Promise<{ rowsAffected: number }>;
  };

  await database.execute(
    `INSERT INTO sync_log (table_name, record_id, action, data, synced, created_at)
     VALUES (?, ?, ?, ?, 0, datetime('now'))`,
    [tableName, recordId, action, JSON.stringify(data)]
  );

  // Update pending changes count
  await database.execute(
    `UPDATE sync_status SET pending_changes = (
      SELECT COUNT(*) FROM sync_log WHERE synced = 0
    ) WHERE id = 1`
  );
}

export async function getPendingChanges(): Promise<number> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{ pending_changes: number }>(
    'SELECT pending_changes FROM sync_status WHERE id = 1'
  );

  return rows[0]?.pending_changes || 0;
}

export async function getUnsyncedChanges(): Promise<{
  tableName: string;
  recordId: string;
  action: string;
  data: unknown;
  createdAt: string;
}[]> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    table_name: string;
    record_id: string;
    action: string;
    data: string;
    created_at: string;
  }>('SELECT * FROM sync_log WHERE synced = 0 ORDER BY created_at');

  return rows.map((row) => ({
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    data: JSON.parse(row.data || '{}'),
    createdAt: row.created_at,
  }));
}

export async function markAsSynced(recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;

  const database = await getDatabase() as {
    execute: (query: string, params?: unknown[]) => Promise<{ rowsAffected: number }>;
  };

  const placeholders = recordIds.map(() => '?').join(',');

  await database.execute(
    `UPDATE sync_log SET synced = 1, synced_at = datetime('now')
     WHERE record_id IN (${placeholders})`,
    recordIds
  );

  // Update pending changes count
  await database.execute(
    `UPDATE sync_status SET pending_changes = (
      SELECT COUNT(*) FROM sync_log WHERE synced = 0
    ), last_sync_at = datetime('now'), last_sync_status = 'SUCCESS' WHERE id = 1`
  );
}

export async function getLastSyncStatus(): Promise<{
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  pendingChanges: number;
}> {
  const database = await getDatabase() as {
    select: <T>(query: string, params?: unknown[]) => Promise<T[]>;
  };

  const rows = await database.select<{
    last_sync_at: string | null;
    last_sync_status: string | null;
    pending_changes: number;
  }>('SELECT * FROM sync_status WHERE id = 1');

  if (rows.length === 0) {
    return { lastSyncAt: null, lastSyncStatus: null, pendingChanges: 0 };
  }

  return {
    lastSyncAt: rows[0].last_sync_at,
    lastSyncStatus: rows[0].last_sync_status,
    pendingChanges: rows[0].pending_changes,
  };
}

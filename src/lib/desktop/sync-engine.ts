/**
 * ScheduleOS Sync Engine
 * Handles synchronization between local SQLite and cloud PostgreSQL
 */

import {
  isDesktopMode,
  getUnsyncedChanges,
  markAsSynced,
  getLastSyncStatus,
} from './offline-db';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
  timestamp: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
  pendingChanges: number;
}

// Cloud API base URL - configured during build
const CLOUD_API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Check if online
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// Initialize sync listeners
export function initSyncListeners(onStatusChange: (status: SyncStatus) => void): () => void {
  if (!isDesktopMode()) {
    return () => {};
  }

  const updateStatus = async () => {
    const dbStatus = await getLastSyncStatus();
    onStatusChange({
      isOnline: isOnline(),
      isSyncing: false,
      lastSyncAt: dbStatus.lastSyncAt,
      lastSyncStatus: dbStatus.lastSyncStatus as SyncStatus['lastSyncStatus'],
      pendingChanges: dbStatus.pendingChanges,
    });
  };

  // Listen for online/offline events
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  // Initial status check
  updateStatus();

  // Return cleanup function
  return () => {
    window.removeEventListener('online', updateStatus);
    window.removeEventListener('offline', updateStatus);
  };
}

// Sync local changes to cloud
export async function syncToCloud(authToken: string): Promise<SyncResult> {
  if (!isDesktopMode()) {
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: ['Not in desktop mode'],
      timestamp: new Date().toISOString(),
    };
  }

  if (!isOnline()) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      errors: ['No internet connection'],
      timestamp: new Date().toISOString(),
    };
  }

  const changes = await getUnsyncedChanges();

  if (changes.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  }

  const syncedIds: string[] = [];
  const errors: string[] = [];

  for (const change of changes) {
    try {
      const response = await fetch(`${CLOUD_API_URL}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          table: change.tableName,
          action: change.action,
          recordId: change.recordId,
          data: change.data,
        }),
      });

      if (response.ok) {
        syncedIds.push(change.recordId);
      } else {
        const error = await response.text();
        errors.push(`Failed to sync ${change.tableName}/${change.recordId}: ${error}`);
      }
    } catch (err) {
      errors.push(`Error syncing ${change.tableName}/${change.recordId}: ${err}`);
    }
  }

  // Mark successfully synced changes
  if (syncedIds.length > 0) {
    await markAsSynced(syncedIds);
  }

  return {
    success: errors.length === 0,
    syncedCount: syncedIds.length,
    failedCount: errors.length,
    errors,
    timestamp: new Date().toISOString(),
  };
}

// Pull latest data from cloud to local
export async function syncFromCloud(
  authToken: string,
  organizationId: string,
  lastSyncAt?: string
): Promise<SyncResult> {
  if (!isDesktopMode()) {
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: ['Not in desktop mode'],
      timestamp: new Date().toISOString(),
    };
  }

  if (!isOnline()) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      errors: ['No internet connection'],
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Fetch data updated since last sync
    const params = new URLSearchParams({
      organizationId,
      ...(lastSyncAt && { since: lastSyncAt }),
    });

    const response = await fetch(`${CLOUD_API_URL}/api/sync/pull?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    // Import data into local database
    const imported = await importCloudData(data);

    return {
      success: true,
      syncedCount: imported,
      failedCount: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 1,
      errors: [`Failed to sync from cloud: ${err}`],
      timestamp: new Date().toISOString(),
    };
  }
}

// Full two-way sync
export async function fullSync(
  authToken: string,
  organizationId: string
): Promise<SyncResult> {
  const results: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // First, push local changes to cloud
  const pushResult = await syncToCloud(authToken);
  results.syncedCount += pushResult.syncedCount;
  results.failedCount += pushResult.failedCount;
  results.errors.push(...pushResult.errors);

  if (!pushResult.success) {
    results.success = false;
  }

  // Then, pull latest from cloud
  const dbStatus = await getLastSyncStatus();
  const pullResult = await syncFromCloud(authToken, organizationId, dbStatus.lastSyncAt || undefined);
  results.syncedCount += pullResult.syncedCount;
  results.failedCount += pullResult.failedCount;
  results.errors.push(...pullResult.errors);

  if (!pullResult.success) {
    results.success = false;
  }

  return results;
}

// Import cloud data into local database
async function importCloudData(data: {
  users?: unknown[];
  crews?: unknown[];
  schedules?: unknown[];
  positions?: unknown[];
  timeOffRequests?: unknown[];
}): Promise<number> {
  // Dynamic import for database operations
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const db = await Database.load('sqlite:scheduleos.db');

  let count = 0;

  // Import users
  if (data.users) {
    for (const user of data.users as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO users (
          id, email, name, role, position, status, rotation_group, primary_position,
          is_ccr_qualified, is_ps_capable, is_pl_capable, organization_id, crew_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.email,
          user.name,
          user.role,
          user.position,
          user.status,
          user.rotationGroup,
          user.primaryPosition,
          user.isCCRQualified ? 1 : 0,
          user.isPSCapable ? 1 : 0,
          user.isPLCapable ? 1 : 0,
          user.organizationId,
          user.crewId,
          user.createdAt,
          user.updatedAt,
        ]
      );
      count++;
    }
  }

  // Import crews
  if (data.crews) {
    for (const crew of data.crews as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO crews (
          id, name, code, description, color, current_phase, alternates_day_night,
          organization_id, rotation_pattern_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crew.id,
          crew.name,
          crew.code,
          crew.description,
          crew.color,
          crew.currentPhase,
          crew.alternatesDayNight ? 1 : 0,
          crew.organizationId,
          crew.rotationPatternId,
          crew.createdAt,
          crew.updatedAt,
        ]
      );
      count++;
    }
  }

  // Import schedules
  if (data.schedules) {
    for (const schedule of data.schedules as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO schedules (
          id, date, shift_type, is_override, override_reason, notes,
          is_backfill, backfill_role, user_id, crew_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          schedule.id,
          schedule.date,
          schedule.shiftType,
          schedule.isOverride ? 1 : 0,
          schedule.overrideReason,
          schedule.notes,
          schedule.isBackfill ? 1 : 0,
          schedule.backfillRole,
          schedule.userId,
          schedule.crewId,
          schedule.createdAt,
          schedule.updatedAt,
        ]
      );
      count++;
    }
  }

  // Import positions
  if (data.positions) {
    for (const position of data.positions as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO positions (
          id, name, code, category, shift_type, min_staffing, max_staffing,
          required_qualifications, sort_order, organization_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          position.id,
          position.name,
          position.code,
          position.category,
          position.shiftType,
          position.minStaffing,
          position.maxStaffing,
          JSON.stringify(position.requiredQualifications || []),
          position.sortOrder,
          position.organizationId,
          position.createdAt,
          position.updatedAt,
        ]
      );
      count++;
    }
  }

  // Import time off requests
  if (data.timeOffRequests) {
    for (const request of data.timeOffRequests as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO time_off_requests (
          id, start_date, end_date, type, status, reason, notes,
          user_id, approved_by_id, approved_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.id,
          request.startDate,
          request.endDate,
          request.type,
          request.status,
          request.reason,
          request.notes,
          request.userId,
          request.approvedById,
          request.approvedAt,
          request.createdAt,
          request.updatedAt,
        ]
      );
      count++;
    }
  }

  return count;
}

// Auto-sync interval (when online)
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(
  authToken: string,
  organizationId: string,
  intervalMs: number = 5 * 60 * 1000 // 5 minutes default
): void {
  if (!isDesktopMode()) return;

  stopAutoSync();

  autoSyncInterval = setInterval(async () => {
    if (isOnline()) {
      console.log('Auto-syncing...');
      await fullSync(authToken, organizationId);
    }
  }, intervalMs);

  // Also sync immediately on start
  if (isOnline()) {
    fullSync(authToken, organizationId);
  }
}

export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

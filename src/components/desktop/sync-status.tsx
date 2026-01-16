'use client';

/**
 * Sync Status Indicator
 * Shows sync status in desktop app header
 */

import React from 'react';
import { useDesktop } from '@/components/providers/desktop-provider';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
  const { isDesktop, syncStatus, triggerSync } = useDesktop();

  // Only show in desktop mode
  if (!isDesktop) return null;

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return <CloudOff className="h-4 w-4 text-gray-400" />;
    }
    if (syncStatus.isSyncing) {
      return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (syncStatus.lastSyncStatus === 'SUCCESS') {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (syncStatus.lastSyncStatus === 'FAILED') {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
    return <Cloud className="h-4 w-4 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) {
      return 'Offline';
    }
    if (syncStatus.isSyncing) {
      return 'Syncing...';
    }
    if (syncStatus.lastSyncAt) {
      return `Synced ${formatDistanceToNow(new Date(syncStatus.lastSyncAt), { addSuffix: true })}`;
    }
    return 'Not synced';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
      {getStatusIcon()}
      <span className="text-sm text-muted-foreground">{getStatusText()}</span>

      {syncStatus.pendingChanges > 0 && (
        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
          {syncStatus.pendingChanges} pending
        </span>
      )}

      {syncStatus.isOnline && !syncStatus.isSyncing && (
        <button
          onClick={triggerSync}
          className="p-1 hover:bg-muted-foreground/10 rounded"
          title="Sync now"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Offline Banner
 * Shows when the app is offline
 */
export function OfflineBanner() {
  const { isDesktop, syncStatus } = useDesktop();

  // Only show in desktop mode when offline
  if (!isDesktop || syncStatus.isOnline) return null;

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
      <div className="flex items-center gap-2 text-yellow-800">
        <CloudOff className="h-4 w-4" />
        <span className="text-sm font-medium">
          You&apos;re offline. Changes will sync when you reconnect.
        </span>
        {syncStatus.pendingChanges > 0 && (
          <span className="text-sm">
            ({syncStatus.pendingChanges} changes pending)
          </span>
        )}
      </div>
    </div>
  );
}

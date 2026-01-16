'use client';

/**
 * Desktop Mode Provider
 * Provides context for desktop app features including sync status
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
  pendingChanges: number;
}

interface DesktopContextType {
  isDesktop: boolean;
  syncStatus: SyncStatus;
  triggerSync: () => Promise<void>;
}

const defaultSyncStatus: SyncStatus = {
  isOnline: true,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncStatus: null,
  pendingChanges: 0,
};

const DesktopContext = createContext<DesktopContextType>({
  isDesktop: false,
  syncStatus: defaultSyncStatus,
  triggerSync: async () => {},
});

export function useDesktop() {
  return useContext(DesktopContext);
}

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [isDesktop, setIsDesktop] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(defaultSyncStatus);

  // Use ref to access current values in interval without re-creating it
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;

  // Check if running in Tauri
  useEffect(() => {
    const checkDesktopMode = () => {
      const isTauri = typeof window !== 'undefined' &&
        ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
      setIsDesktop(isTauri);
    };

    checkDesktopMode();
  }, []);

  // Initialize sync listeners in desktop mode
  useEffect(() => {
    if (!isDesktop) return;

    const updateOnlineStatus = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [isDesktop]);

  const triggerSync = useCallback(async () => {
    if (!isDesktop || !session?.user) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Dynamic import to avoid issues in web mode
      const { fullSync } = await import('@/lib/desktop/sync-engine');

      // Get auth token from session
      const authToken = (session as { accessToken?: string }).accessToken || '';
      const organizationId = (session.user as { organizationId?: string }).organizationId || '';

      const result = await fullSync(authToken, organizationId);

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: result.timestamp,
        lastSyncStatus: result.success ? 'SUCCESS' : result.syncedCount > 0 ? 'PARTIAL' : 'FAILED',
        pendingChanges: result.failedCount,
      }));
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncStatus: 'FAILED',
      }));
    }
  }, [isDesktop, session]);

  // Auto-sync when online in desktop mode
  useEffect(() => {
    if (!isDesktop || !session?.user) return;

    const autoSyncInterval = setInterval(async () => {
      if (navigator.onLine && syncStatusRef.current.pendingChanges > 0) {
        await triggerSync();
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(autoSyncInterval);
  }, [isDesktop, session, triggerSync]);

  return (
    <DesktopContext.Provider value={{ isDesktop, syncStatus, triggerSync }}>
      {children}
    </DesktopContext.Provider>
  );
}

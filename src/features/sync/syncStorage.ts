export const SYNC_TOKEN_KEY = 'hardware-stock-manager:syncToken'
export const AUTO_SYNC_KEY = 'hardware-stock-manager:autoSyncEnabled'
export const SYNC_STATUS_KEY = 'hardware-stock-manager:syncStatus'
export const PENDING_EXPORT_KEY = 'hardware-stock-manager:pendingExportPayload'
export const RETRY_REQUESTED_AT_KEY = 'hardware-stock-manager:syncRetryRequestedAt'

export type SyncStatus = {
  lastImportAt: string | null
  lastExportAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  consecutiveFailures: number
  lastRemoteUpdatedAt: string | null
}

export function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch (err) {
    void err
  }
}

export function removeLocalStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    void err
  }
}

export function readSyncStatus(): SyncStatus {
  const raw = readLocalStorage(SYNC_STATUS_KEY)
  if (!raw) {
    return {
      lastImportAt: null,
      lastExportAt: null,
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      lastRemoteUpdatedAt: null,
    }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncStatus>
    return {
      lastImportAt: typeof parsed.lastImportAt === 'string' ? parsed.lastImportAt : null,
      lastExportAt: typeof parsed.lastExportAt === 'string' ? parsed.lastExportAt : null,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
      lastErrorAt: typeof parsed.lastErrorAt === 'string' ? parsed.lastErrorAt : null,
      consecutiveFailures:
        typeof parsed.consecutiveFailures === 'number' && Number.isFinite(parsed.consecutiveFailures)
          ? parsed.consecutiveFailures
          : 0,
      lastRemoteUpdatedAt:
        typeof parsed.lastRemoteUpdatedAt === 'string' ? parsed.lastRemoteUpdatedAt : null,
    }
  } catch {
    return {
      lastImportAt: null,
      lastExportAt: null,
      lastError: null,
      lastErrorAt: null,
      consecutiveFailures: 0,
      lastRemoteUpdatedAt: null,
    }
  }
}

export function writeSyncStatus(next: SyncStatus) {
  writeLocalStorage(SYNC_STATUS_KEY, JSON.stringify(next))
}

export function updateSyncStatus(patch: Partial<SyncStatus>) {
  const current = readSyncStatus()
  writeSyncStatus({ ...current, ...patch })
}

export function bumpRetryRequest() {
  writeLocalStorage(RETRY_REQUESTED_AT_KEY, String(Date.now()))
}


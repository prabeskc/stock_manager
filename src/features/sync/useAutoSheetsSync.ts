import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInventoryStore } from '../../store/inventoryStore'
import type {
  CementProduct,
  CementTransaction,
  InventoryItem,
  InventoryTransaction,
  RodSize,
} from '../../domain/inventory'
import { computeBackoffMs } from './backoff'
import {
  AUTO_SYNC_KEY,
  PENDING_EXPORT_KEY,
  RETRY_REQUESTED_AT_KEY,
  SYNC_TOKEN_KEY,
  updateSyncStatus,
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from './syncStorage'

type SyncState = {
  enabled: boolean
  token: string
}

const META_POLL_MS = 30000
const EXPORT_DEBOUNCE_MS = 1500
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000

function readSyncState(): SyncState {
  const token = readLocalStorage(SYNC_TOKEN_KEY) ?? ''
  const enabledRaw = readLocalStorage(AUTO_SYNC_KEY)
  const enabled = enabledRaw == null ? token.length > 0 : enabledRaw === 'true'
  return { enabled, token }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isRodSize(value: unknown): value is RodSize {
  return value === '8mm' || value === '10mm' || value === '12mm'
}

function isCementProduct(value: unknown): value is CementProduct {
  return value === 'PPC' || value === 'OPC'
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (!isRecord(value)) return false
  return (
    typeof value.quantity === 'number' &&
    typeof value.averageCostPrice === 'number' &&
    typeof value.sellingPrice === 'number' &&
    typeof value.lowStockThreshold === 'number'
  )
}

function isInventoryItems(value: unknown): value is Record<RodSize, InventoryItem> {
  if (!isRecord(value)) return false
  return (
    isInventoryItem(value['8mm']) &&
    isInventoryItem(value['10mm']) &&
    isInventoryItem(value['12mm'])
  )
}

function isCementItems(value: unknown): value is Record<CementProduct, InventoryItem> {
  if (!isRecord(value)) return false
  return isInventoryItem(value.PPC) && isInventoryItem(value.OPC)
}

function isTransaction(value: unknown): value is InventoryTransaction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.type === 'ADD' || value.type === 'SALE') &&
    isRodSize(value.size) &&
    typeof value.quantity === 'number' &&
    (typeof value.unitCost === 'number' || value.unitCost === null) &&
    (typeof value.unitPrice === 'number' || value.unitPrice === null) &&
    typeof value.profit === 'number' &&
    typeof value.createdAt === 'string'
  )
}

function isTransactions(value: unknown): value is InventoryTransaction[] {
  return Array.isArray(value) && value.every(isTransaction)
}

function isCementTransaction(value: unknown): value is CementTransaction {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.type === 'ADD' || value.type === 'SALE') &&
    isCementProduct(value.product) &&
    typeof value.quantity === 'number' &&
    (typeof value.unitCost === 'number' || value.unitCost === null) &&
    (typeof value.unitPrice === 'number' || value.unitPrice === null) &&
    typeof value.profit === 'number' &&
    typeof value.createdAt === 'string'
  )
}

function isCementTransactions(value: unknown): value is CementTransaction[] {
  return Array.isArray(value) && value.every(isCementTransaction)
}

function getMetaUpdatedAt(value: unknown): string | null {
  if (!isRecord(value)) return null
  const meta = value.meta
  if (!isRecord(meta)) return null
  const updatedAt = meta.updatedAt
  return typeof updatedAt === 'string' ? updatedAt : null
}

function getResponseData(value: unknown): unknown | null {
  if (!isRecord(value)) return null
  return 'data' in value ? value.data : null
}

function getRetryAfterSeconds(res: Response): number | null {
  const value = res.headers.get('retry-after')
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function readJsonSafely(res: Response): Promise<unknown | null> {
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return null
  return (await res.json().catch(() => null)) as unknown
}

function formatFetchError({
  url,
  status,
  json,
}: {
  url: string
  status: number
  json: unknown | null
}): string {
  if (isRecord(json) && typeof json.error === 'string') return json.error
  if (status === 401) return 'Unauthorized (check sync token).'
  if (status === 429) return 'Rate limited by Google/Vercel. Retrying…'
  if (status >= 500) return 'Server error. Retrying…'
  return `Request failed (${status}) for ${url}`
}

export function useAutoSheetsSync() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const cementItems = useInventoryStore((s) => s.cementItems)
  const cementTransactions = useInventoryStore((s) => s.cementTransactions)
  const setAll = useInventoryStore((s) => s.setAll)

  const [syncState, setSyncState] = useState<SyncState>(() => ({ enabled: false, token: '' }))

  useEffect(() => {
    setSyncState(readSyncState())
    const id = window.setInterval(() => setSyncState(readSyncState()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const payload = useMemo(
    () => JSON.stringify({ items, transactions, cementItems, cementTransactions }),
    [items, transactions, cementItems, cementTransactions],
  )

  const lastExportedPayloadRef = useRef<string | null>(null)
  const lastRemoteUpdatedAtRef = useRef<string | null>(null)
  const importInFlightRef = useRef(false)
  const exportInFlightRef = useRef(false)
  const exportTimerRef = useRef<number | null>(null)
  const hasImportedOnceRef = useRef(false)
  const retryTimerRef = useRef<number | null>(null)
  const lastRetryRequestRef = useRef<string | null>(null)
  const failureCountRef = useRef(0)

  const authHeaders = useMemo(() => {
    if (!syncState.token) return null
    return { 'x-sync-token': syncState.token }
  }, [syncState.token])

  const importFromSheet = useCallback(async () => {
    if (!authHeaders) return
    if (importInFlightRef.current) return
    importInFlightRef.current = true
    try {
      const url = '/api/sheets/import'
      const res = await fetch(url, { headers: authHeaders, cache: 'no-store' })
      const json = await readJsonSafely(res)
      if (!res.ok) {
        failureCountRef.current += 1
        updateSyncStatus({
          lastError: formatFetchError({ url, status: res.status, json }),
          lastErrorAt: new Date().toISOString(),
          consecutiveFailures: failureCountRef.current,
        })
        return
      }
      if (!isRecord(json) || json.ok !== true) return

      const updatedAt = getMetaUpdatedAt(json)
      const data = getResponseData(json)
      if (
        isRecord(data) &&
        isInventoryItems(data.items) &&
        isTransactions(data.transactions) &&
        (!('cementItems' in data) || isCementItems(data.cementItems)) &&
        (!('cementTransactions' in data) || isCementTransactions(data.cementTransactions))
      ) {
        const nextCementItems =
          'cementItems' in data && isCementItems(data.cementItems) ? data.cementItems : undefined
        const nextCementTransactions =
          'cementTransactions' in data && isCementTransactions(data.cementTransactions)
            ? data.cementTransactions
            : undefined

        setAll({
          items: data.items,
          transactions: data.transactions,
          cementItems: nextCementItems,
          cementTransactions: nextCementTransactions,
        })
        lastExportedPayloadRef.current = JSON.stringify({
          items: data.items,
          transactions: data.transactions,
          cementItems: nextCementItems,
          cementTransactions: nextCementTransactions,
        })
      }
      hasImportedOnceRef.current = true
      lastRemoteUpdatedAtRef.current = updatedAt
      updateSyncStatus({
        lastImportAt: new Date().toISOString(),
        lastError: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
        lastRemoteUpdatedAt: updatedAt,
      })
      failureCountRef.current = 0
    } finally {
      importInFlightRef.current = false
    }
  }, [authHeaders, setAll])

  const exportToSheet = useCallback(async () => {
    if (!authHeaders) return
    if (exportInFlightRef.current) return
    exportInFlightRef.current = true
    try {
      const url = '/api/sheets/export'
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: payload,
        cache: 'no-store',
      })
      const json = await readJsonSafely(res)
      if (!res.ok) {
        writeLocalStorage(PENDING_EXPORT_KEY, payload)
        failureCountRef.current += 1
        updateSyncStatus({
          lastError: formatFetchError({ url, status: res.status, json }),
          lastErrorAt: new Date().toISOString(),
          consecutiveFailures: failureCountRef.current,
        })
        const retryAfterSeconds = res.status === 429 ? getRetryAfterSeconds(res) : null
        const delayMs = computeBackoffMs({
          attempt: failureCountRef.current,
          baseMs: BASE_BACKOFF_MS,
          maxMs: MAX_BACKOFF_MS,
          retryAfterSeconds,
        })
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = window.setTimeout(() => {
          void exportToSheet()
        }, delayMs)
        return
      }
      if (!isRecord(json) || json.ok !== true) return
      const updatedAt = getMetaUpdatedAt(json)
      lastRemoteUpdatedAtRef.current = updatedAt
      lastExportedPayloadRef.current = payload
      removeLocalStorage(PENDING_EXPORT_KEY)
      updateSyncStatus({
        lastExportAt: new Date().toISOString(),
        lastError: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
        lastRemoteUpdatedAt: updatedAt,
      })
      failureCountRef.current = 0
    } finally {
      exportInFlightRef.current = false
    }
  }, [authHeaders, payload])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return
    void importFromSheet()
  }, [authHeaders, importFromSheet, syncState.enabled])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return
    if (!hasImportedOnceRef.current) return
    if (payload === lastExportedPayloadRef.current) return

    if (exportTimerRef.current) window.clearTimeout(exportTimerRef.current)
    exportTimerRef.current = window.setTimeout(() => {
      void exportToSheet()
    }, EXPORT_DEBOUNCE_MS)

    return () => {
      if (exportTimerRef.current) window.clearTimeout(exportTimerRef.current)
      exportTimerRef.current = null
    }
  }, [authHeaders, exportToSheet, payload, syncState.enabled])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return

    const pending = readLocalStorage(PENDING_EXPORT_KEY)
    if (pending && pending !== lastExportedPayloadRef.current && !exportInFlightRef.current) {
      void exportToSheet()
    }
  }, [authHeaders, exportToSheet, syncState.enabled])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return

    const tick = async () => {
      if (importInFlightRef.current || exportInFlightRef.current) return
      const url = '/api/sheets/meta'
      const res = await fetch(url, { headers: authHeaders, cache: 'no-store' })
      const json = await readJsonSafely(res)
      if (!res.ok) {
        updateSyncStatus({
          lastError: formatFetchError({ url, status: res.status, json }),
          lastErrorAt: new Date().toISOString(),
        })
        return
      }
      if (!isRecord(json) || json.ok !== true) return

      const meta = json.meta
      const remoteUpdatedAt = isRecord(meta) && typeof meta.updatedAt === 'string' ? meta.updatedAt : null
      const localKnown = lastRemoteUpdatedAtRef.current
      if (!remoteUpdatedAt || remoteUpdatedAt === localKnown) return

      lastRemoteUpdatedAtRef.current = remoteUpdatedAt
      updateSyncStatus({ lastRemoteUpdatedAt: remoteUpdatedAt })
      void importFromSheet()
    }

    const id = window.setInterval(() => void tick(), META_POLL_MS)
    return () => window.clearInterval(id)
  }, [authHeaders, importFromSheet, syncState.enabled])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return

    const onOnline = () => {
      void importFromSheet()
      void exportToSheet()
    }

    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [authHeaders, exportToSheet, importFromSheet, syncState.enabled])

  useEffect(() => {
    if (!syncState.enabled) return
    if (!authHeaders) return
    const id = window.setInterval(() => {
      const current = readLocalStorage(RETRY_REQUESTED_AT_KEY)
      if (!current || current === lastRetryRequestRef.current) return
      lastRetryRequestRef.current = current
      void importFromSheet()
      void exportToSheet()
    }, 1000)
    return () => window.clearInterval(id)
  }, [authHeaders, exportToSheet, importFromSheet, syncState.enabled])
}

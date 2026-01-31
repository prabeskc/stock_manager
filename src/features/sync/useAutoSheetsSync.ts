import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInventoryStore } from '../../store/inventoryStore'
import type { InventoryItem, InventoryTransaction, RodSize } from '../../domain/inventory'

type SyncState = {
  enabled: boolean
  token: string
}

const SYNC_TOKEN_KEY = 'hardware-stock-manager:syncToken'
const AUTO_SYNC_KEY = 'hardware-stock-manager:autoSyncEnabled'
const META_POLL_MS = 30000
const EXPORT_DEBOUNCE_MS = 1500

function readLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

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

export function useAutoSheetsSync() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const setAll = useInventoryStore((s) => s.setAll)

  const [syncState, setSyncState] = useState<SyncState>(() => ({ enabled: false, token: '' }))

  useEffect(() => {
    setSyncState(readSyncState())
    const id = window.setInterval(() => setSyncState(readSyncState()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const payload = useMemo(() => JSON.stringify({ items, transactions }), [items, transactions])

  const lastExportedPayloadRef = useRef<string | null>(null)
  const lastRemoteUpdatedAtRef = useRef<string | null>(null)
  const importInFlightRef = useRef(false)
  const exportInFlightRef = useRef(false)
  const exportTimerRef = useRef<number | null>(null)
  const hasImportedOnceRef = useRef(false)

  const authHeaders = useMemo(() => {
    if (!syncState.token) return null
    return { 'x-sync-token': syncState.token }
  }, [syncState.token])

  const importFromSheet = useCallback(async () => {
    if (!authHeaders) return
    if (importInFlightRef.current) return
    importInFlightRef.current = true
    try {
      const res = await fetch('/api/sheets/import', { headers: authHeaders })
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok) return
      if (!isRecord(json) || json.ok !== true) return

      const updatedAt = getMetaUpdatedAt(json)
      const data = getResponseData(json)
      if (isRecord(data) && isInventoryItems(data.items) && isTransactions(data.transactions)) {
        setAll({ items: data.items, transactions: data.transactions })
      }
      hasImportedOnceRef.current = true
      lastRemoteUpdatedAtRef.current = updatedAt
      lastExportedPayloadRef.current = payload
    } finally {
      importInFlightRef.current = false
    }
  }, [authHeaders, payload, setAll])

  const exportToSheet = useCallback(async () => {
    if (!authHeaders) return
    if (exportInFlightRef.current) return
    exportInFlightRef.current = true
    try {
      const res = await fetch('/api/sheets/export', {
        method: 'POST',
        headers: { ...authHeaders, 'content-type': 'application/json' },
        body: payload,
      })
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok) return
      if (!isRecord(json) || json.ok !== true) return
      const updatedAt = getMetaUpdatedAt(json)
      lastRemoteUpdatedAtRef.current = updatedAt
      lastExportedPayloadRef.current = payload
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

    const tick = async () => {
      if (importInFlightRef.current || exportInFlightRef.current) return
      const res = await fetch('/api/sheets/meta', { headers: authHeaders })
      const json = (await res.json().catch(() => null)) as unknown
      if (!res.ok) return
      if (!isRecord(json) || json.ok !== true) return

      const meta = json.meta
      const remoteUpdatedAt = isRecord(meta) && typeof meta.updatedAt === 'string' ? meta.updatedAt : null
      const localKnown = lastRemoteUpdatedAtRef.current
      if (!remoteUpdatedAt || remoteUpdatedAt === localKnown) return

      lastRemoteUpdatedAtRef.current = remoteUpdatedAt
      void importFromSheet()
    }

    const id = window.setInterval(() => void tick(), META_POLL_MS)
    return () => window.clearInterval(id)
  }, [authHeaders, importFromSheet, syncState.enabled])
}

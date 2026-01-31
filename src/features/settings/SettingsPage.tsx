import { useEffect, useState } from 'react'
import { CEMENT_PRODUCTS, ROD_SIZES, type CementProduct, type RodSize } from '../../domain/inventory'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useInventoryStore } from '../../store/inventoryStore'
import { bumpRetryRequest, readSyncStatus, updateSyncStatus } from '../sync/syncStorage'

export function SettingsPage() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const cementItems = useInventoryStore((s) => s.cementItems)
  const cementTransactions = useInventoryStore((s) => s.cementTransactions)
  const setLowStockThreshold = useInventoryStore((s) => s.setLowStockThreshold)
  const setCementLowStockThreshold = useInventoryStore((s) => s.setCementLowStockThreshold)
  const setAll = useInventoryStore((s) => s.setAll)
  const reset = useInventoryStore((s) => s.reset)

  const [confirming, setConfirming] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncToken, setSyncToken] = useState(() => {
    try {
      return localStorage.getItem('hardware-stock-manager:syncToken') ?? ''
    } catch {
      return ''
    }
  })
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('hardware-stock-manager:autoSyncEnabled')
      if (raw == null) return true
      return raw === 'true'
    } catch {
      return true
    }
  })
  const [status, setStatus] = useState(() => readSyncStatus())

  useEffect(() => {
    const id = window.setInterval(() => setStatus(readSyncStatus()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const ensureJsonResponse = (res: Response) => {
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error('Google Sheets API is not available. If local, run: npm run dev:full')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Low Stock Thresholds</div>
          <div className="text-sm text-slate-500">Used for the “Low stock” status badge</div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {ROD_SIZES.map((size) => (
            <ThresholdField
              key={size}
              size={size}
              value={items[size].lowStockThreshold}
              onChange={(next) => setLowStockThreshold(size, next)}
            />
          ))}
          {CEMENT_PRODUCTS.map((product) => (
            <CementThresholdField
              key={product}
              product={product}
              value={cementItems[product].lowStockThreshold}
              onChange={(next) => setCementLowStockThreshold(product, next)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Data</div>
          <div className="text-sm text-slate-500">
            Inventory is stored locally in your browser (localStorage).
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!confirming ? (
            <Button variant="danger" type="button" onClick={() => setConfirming(true)}>
              Reset All Data
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  reset()
                  setConfirming(false)
                }}
              >
                Confirm Reset
              </Button>
              <Button variant="secondary" type="button" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Google Sheets Sync</div>
          <div className="text-sm text-slate-500">
            Requires server-side API (Vercel) with environment variables set.
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="text-base font-medium text-slate-700">Sync Token</div>
            <Input
              type="password"
              value={syncToken}
              onChange={(e) => {
                const next = e.target.value
                setSyncToken(next)
                try {
                  if (next) localStorage.setItem('hardware-stock-manager:syncToken', next)
                  else localStorage.removeItem('hardware-stock-manager:syncToken')
                } catch (err) {
                  void err
                }
              }}
              placeholder="Enter your sync token"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-slate-500">
                Saved on this device (localStorage) so you don’t type it every time.
              </div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setSyncToken('')
                  try {
                    localStorage.removeItem('hardware-stock-manager:syncToken')
                  } catch (err) {
                    void err
                  }
                }}
              >
                Clear Token
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              This token is checked server-side to prevent others from reading/writing your sheet.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="grid gap-1">
              <div className="text-base font-medium text-slate-700">Auto Sync</div>
              <div className="text-sm text-slate-500">
                When enabled, the app imports updates and exports changes automatically.
              </div>
            </div>
            <label className="flex min-h-11 select-none items-center gap-2 rounded-md bg-white px-3 text-base ring-1 ring-slate-200">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={autoSyncEnabled}
                onChange={(e) => {
                  const next = e.target.checked
                  setAutoSyncEnabled(next)
                  try {
                    localStorage.setItem('hardware-stock-manager:autoSyncEnabled', String(next))
                  } catch (err) {
                    void err
                  }
                }}
              />
              Enabled
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-medium text-slate-700">Sync Status</div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  bumpRetryRequest()
                  setSyncMessage('Retry requested. Sync will run now.')
                }}
              >
                Retry Now
              </Button>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-500">Last import</div>
                <div>{status.lastImportAt ? new Date(status.lastImportAt).toLocaleString() : '—'}</div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-500">Last export</div>
                <div>{status.lastExportAt ? new Date(status.lastExportAt).toLocaleString() : '—'}</div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-500">Sheet updatedAt</div>
                <div>
                  {status.lastRemoteUpdatedAt ? new Date(status.lastRemoteUpdatedAt).toLocaleString() : '—'}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-slate-500">Failures</div>
                <div>{String(status.consecutiveFailures ?? 0)}</div>
              </div>
            </div>

            {status.lastError ? (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
                {status.lastError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              setSyncMessage(null)
              try {
                const res = await fetch('/api/sheets/import', {
                  headers: { 'x-sync-token': syncToken },
                })
                ensureJsonResponse(res)
                const json = await res.json().catch(() => null)
                if (!res.ok) {
                  throw new Error(json?.error ?? 'Import failed.')
                }
                setAll(json.data)
                updateSyncStatus({
                  lastImportAt: new Date().toISOString(),
                  lastError: null,
                  lastErrorAt: null,
                  consecutiveFailures: 0,
                  lastRemoteUpdatedAt: json?.meta?.updatedAt ?? null,
                })
                setSyncMessage('Imported data from Google Sheets.')
              } catch (e) {
                updateSyncStatus({
                  lastError: e instanceof Error ? e.message : 'Import failed.',
                  lastErrorAt: new Date().toISOString(),
                })
                setSyncMessage(e instanceof Error ? e.message : 'Import failed.')
              } finally {
                setSyncing(false)
              }
            }}
          >
            Import From Sheet
          </Button>

          <Button
            variant="secondary"
            type="button"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true)
              setSyncMessage(null)
              try {
                const res = await fetch('/api/sheets/export', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', 'x-sync-token': syncToken },
                  body: JSON.stringify({ items, transactions, cementItems, cementTransactions }),
                })
                ensureJsonResponse(res)
                const json = await res.json().catch(() => null)
                if (!res.ok) {
                  throw new Error(json?.error ?? 'Export failed.')
                }
                updateSyncStatus({
                  lastExportAt: new Date().toISOString(),
                  lastError: null,
                  lastErrorAt: null,
                  consecutiveFailures: 0,
                  lastRemoteUpdatedAt: json?.meta?.updatedAt ?? null,
                })
                setSyncMessage('Exported data to Google Sheets.')
              } catch (e) {
                updateSyncStatus({
                  lastError: e instanceof Error ? e.message : 'Export failed.',
                  lastErrorAt: new Date().toISOString(),
                })
                setSyncMessage(e instanceof Error ? e.message : 'Export failed.')
              } finally {
                setSyncing(false)
              }
            }}
          >
            Export To Sheet
          </Button>
          </div>
        </div>

        {syncMessage ? (
          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
            {syncMessage}
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function ThresholdField({
  size,
  value,
  onChange,
}: {
  size: RodSize
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-700">{size}</div>
      <div className="mt-2">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  )
}

function CementThresholdField({
  product,
  value,
  onChange,
}: {
  product: CementProduct
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-sm font-medium text-slate-700">{product}</div>
      <div className="mt-2">
        <Input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  )
}

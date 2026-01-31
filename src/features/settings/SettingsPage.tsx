import { useState } from 'react'
import { ROD_SIZES, type RodSize } from '../../domain/inventory'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useInventoryStore } from '../../store/inventoryStore'

export function SettingsPage() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const setLowStockThreshold = useInventoryStore((s) => s.setLowStockThreshold)
  const setAll = useInventoryStore((s) => s.setAll)
  const reset = useInventoryStore((s) => s.reset)

  const [confirming, setConfirming] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncToken, setSyncToken] = useState('')

  const ensureJsonResponse = (res: Response) => {
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error('Google Sheets sync is not running locally. Deploy to Vercel and set env vars.')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Low Stock Thresholds</div>
          <div className="text-xs text-slate-500">Used for the “Low stock” status badge</div>
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
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Data</div>
          <div className="text-xs text-slate-500">
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
          <div className="text-xs text-slate-500">
            Requires server-side API (Vercel) with environment variables set.
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-slate-700">Sync Token</div>
            <Input
              type="password"
              value={syncToken}
              onChange={(e) => setSyncToken(e.target.value)}
              placeholder="Enter your sync token"
            />
            <div className="text-xs text-slate-500">
              This token is checked server-side to prevent others from reading/writing your sheet.
            </div>
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
                setSyncMessage('Imported data from Google Sheets.')
              } catch (e) {
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
                  body: JSON.stringify({ items, transactions }),
                })
                ensureJsonResponse(res)
                const json = await res.json().catch(() => null)
                if (!res.ok) {
                  throw new Error(json?.error ?? 'Export failed.')
                }
                setSyncMessage('Exported data to Google Sheets.')
              } catch (e) {
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
      <div className="text-xs font-medium text-slate-700">{size}</div>
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

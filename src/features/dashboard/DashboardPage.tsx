import { useMemo, useState } from 'react'
import { ROD_SIZES, type RodSize } from '../../domain/inventory'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatMoney, formatNumber } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { ChartsPanel } from './ChartsPanel'

type DialogState =
  | { type: 'none' }
  | { type: 'add'; size: RodSize }
  | { type: 'deduct'; size: RodSize }

export function DashboardPage() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const setSellingPrice = useInventoryStore((s) => s.setSellingPrice)
  const addStock = useInventoryStore((s) => s.addStock)
  const deductStock = useInventoryStore((s) => s.deductStock)

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })

  const metrics = useMemo(() => {
    const sizes = ROD_SIZES
    const totalQuantity = sizes.reduce((sum, size) => sum + items[size].quantity, 0)
    const stockValue = sizes.reduce(
      (sum, size) => sum + items[size].quantity * items[size].averageCostPrice,
      0,
    )
    const lowStockCount = sizes.reduce(
      (sum, size) => sum + (items[size].quantity < items[size].lowStockThreshold ? 1 : 0),
      0,
    )
    const realizedProfit = transactions
      .filter((t) => t.type === 'SALE')
      .reduce((sum, t) => sum + t.profit, 0)

    return { totalQuantity, stockValue, lowStockCount, realizedProfit }
  }, [items, transactions])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="text-xs text-slate-500">Total Stock (pcs)</div>
          <div className="mt-1 text-2xl font-semibold">{formatNumber(metrics.totalQuantity)}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Stock Value (CP)</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(metrics.stockValue)}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Realized Profit</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(metrics.realizedProfit)}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Low Stock Sizes</div>
          <div className="mt-1 text-2xl font-semibold">{formatNumber(metrics.lowStockCount)}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Inventory</div>
              <div className="text-xs text-slate-500">Manage stock by rod size</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium">Qty</th>
                  <th className="py-2 pr-4 font-medium">CP (avg)</th>
                  <th className="py-2 pr-4 font-medium">SP</th>
                  <th className="py-2 pr-4 font-medium">Margin</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ROD_SIZES.map((size) => {
                  const item = items[size]
                  const margin = item.sellingPrice - item.averageCostPrice
                  const isLow = item.quantity < item.lowStockThreshold

                  return (
                    <tr key={size} className="border-b border-slate-50">
                      <td className="py-3 pr-4">
                        <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                          {size}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium">{formatNumber(item.quantity)}</td>
                      <td className="py-3 pr-4">{formatMoney(item.averageCostPrice)}</td>
                      <td className="py-3 pr-4">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.sellingPrice}
                          onChange={(e) => setSellingPrice(size, Number(e.target.value))}
                          className="h-9 max-w-[140px]"
                        />
                      </td>
                      <td className="py-3 pr-4">{formatMoney(margin)}</td>
                      <td className="py-3 pr-4">
                        {isLow ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setDialog({ type: 'add', size })}
                            type="button"
                          >
                            Add
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setDialog({ type: 'deduct', size })}
                            type="button"
                          >
                            Deduct
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3">
            <div className="text-sm font-semibold">Recent Activity</div>
            <div className="text-xs text-slate-500">Latest transactions</div>
          </div>

          <div className="space-y-3">
            {transactions.slice(0, 8).map((t) => (
              <div key={t.id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-700">
                    {t.type === 'SALE' ? 'Sale' : 'Stock added'} • {t.size}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600">Qty: {formatNumber(t.quantity)}</div>
                  {t.type === 'SALE' ? (
                    <div className="font-medium text-slate-900">
                      Profit: {formatMoney(t.profit)}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No transactions yet. Add stock or record a sale to get started.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <ChartsPanel />

      {dialog.type === 'add' ? (
        <AddStockDialog
          size={dialog.size}
          onClose={() => setDialog({ type: 'none' })}
          onSubmit={(input) => addStock(input)}
        />
      ) : null}

      {dialog.type === 'deduct' ? (
        <DeductStockDialog
          size={dialog.size}
          currentSellingPrice={items[dialog.size].sellingPrice}
          onClose={() => setDialog({ type: 'none' })}
          onSubmit={(input) => deductStock(input)}
        />
      ) : null}
    </div>
  )
}

function AddStockDialog({
  size,
  onClose,
  onSubmit,
}: {
  size: RodSize
  onClose: () => void
  onSubmit: (input: { size: RodSize; quantity: number; unitCostPrice: number }) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [unitCostPrice, setUnitCostPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    setQuantity('')
    setUnitCostPrice('')
    onClose()
  }

  return (
    <Modal
      open
      title={`Add Stock • ${size}`}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const qty = Number(quantity)
              const cp = Number(unitCostPrice)
              if (!Number.isFinite(qty) || qty <= 0) {
                setError('Enter a valid quantity.')
                return
              }
              if (!Number.isFinite(cp) || cp < 0) {
                setError('Enter a valid cost price.')
                return
              }
              setError(null)
              onSubmit({ size, quantity: qty, unitCostPrice: cp })
              close()
            }}
          >
            Add Stock
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2">
          <div className="text-sm font-medium text-slate-700">Quantity</div>
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 50"
          />
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium text-slate-700">Cost Price (CP) per unit</div>
          <Input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={unitCostPrice}
            onChange={(e) => setUnitCostPrice(e.target.value)}
            placeholder="e.g. 520.00"
          />
        </div>
        {error ? (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function DeductStockDialog({
  size,
  currentSellingPrice,
  onClose,
  onSubmit,
}: {
  size: RodSize
  currentSellingPrice: number
  onClose: () => void
  onSubmit: (input: {
    size: RodSize
    quantity: number
    unitSellingPrice?: number
  }) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [unitSellingPrice, setUnitSellingPrice] = useState(String(currentSellingPrice || 0))
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    setQuantity('')
    setUnitSellingPrice(String(currentSellingPrice || 0))
    onClose()
  }

  return (
    <Modal
      open
      title={`Deduct Stock • ${size}`}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const qty = Number(quantity)
              const sp = Number(unitSellingPrice)
              if (!Number.isFinite(qty) || qty <= 0) {
                setError('Enter a valid quantity.')
                return
              }
              if (!Number.isFinite(sp) || sp < 0) {
                setError('Enter a valid selling price.')
                return
              }
              setError(null)
              try {
                onSubmit({ size, quantity: qty, unitSellingPrice: sp })
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to deduct stock.')
                return
              }
              close()
            }}
          >
            Deduct Stock
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2">
          <div className="text-sm font-medium text-slate-700">Quantity</div>
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 10"
          />
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium text-slate-700">Selling Price (SP) per unit</div>
          <Input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={unitSellingPrice}
            onChange={(e) => setUnitSellingPrice(e.target.value)}
            placeholder="e.g. 650.00"
          />
        </div>
        {error ? (
          <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

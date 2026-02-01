import { Suspense, lazy, useMemo, useState } from 'react'
import { CEMENT_PRODUCTS, ROD_SIZES, type CementProduct, type RodSize } from '../../domain/inventory'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatMoney, formatNumber } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'

const ChartsPanel = lazy(() => import('./ChartsPanel').then((m) => ({ default: m.ChartsPanel })))

type DialogState =
  | { type: 'none' }
  | { type: 'add'; size: RodSize }
  | { type: 'deduct'; size: RodSize }
  | { type: 'cementAdd'; product: CementProduct }
  | { type: 'cementDeduct'; product: CementProduct }

export function DashboardPage() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)
  const cementItems = useInventoryStore((s) => s.cementItems)
  const cementTransactions = useInventoryStore((s) => s.cementTransactions)
  const setAverageCostPrice = useInventoryStore((s) => s.setAverageCostPrice)
  const setSellingPrice = useInventoryStore((s) => s.setSellingPrice)
  const setCementAverageCostPrice = useInventoryStore((s) => s.setCementAverageCostPrice)
  const setCementSellingPrice = useInventoryStore((s) => s.setCementSellingPrice)
  const addStock = useInventoryStore((s) => s.addStock)
  const deductStock = useInventoryStore((s) => s.deductStock)
  const addCementStock = useInventoryStore((s) => s.addCementStock)
  const deductCementStock = useInventoryStore((s) => s.deductCementStock)

  const [dialog, setDialog] = useState<DialogState>({ type: 'none' })

  const metrics = useMemo(() => {
    const sizes = ROD_SIZES
    const totalQuantity = sizes.reduce((sum, size) => sum + items[size].quantity, 0)
    const stockValue = sizes.reduce(
      (sum, size) => sum + items[size].quantity * items[size].averageCostPrice,
      0,
    )
    const lowStockCount = sizes.reduce(
      (sum, size) =>
        sum +
        (Math.round(items[size].bundles ?? 0) < items[size].lowStockThreshold ? 1 : 0),
      0,
    )
    const realizedProfit = transactions
      .filter((t) => t.type === 'SALE')
      .reduce((sum, t) => sum + t.profit, 0)

    return { totalQuantity, stockValue, lowStockCount, realizedProfit }
  }, [items, transactions])

  const cementMetrics = useMemo(() => {
    const products = CEMENT_PRODUCTS
    const totalQuantity = products.reduce((sum, product) => sum + cementItems[product].quantity, 0)
    const stockValue = products.reduce(
      (sum, product) => sum + cementItems[product].quantity * cementItems[product].averageCostPrice,
      0,
    )
    const lowStockCount = products.reduce(
      (sum, product) =>
        sum + (cementItems[product].quantity < cementItems[product].lowStockThreshold ? 1 : 0),
      0,
    )
    const realizedProfit = cementTransactions
      .filter((t) => t.type === 'SALE')
      .reduce((sum, t) => sum + t.profit, 0)

    return { totalQuantity, stockValue, lowStockCount, realizedProfit }
  }, [cementItems, cementTransactions])

  const totalStockValue = metrics.stockValue + cementMetrics.stockValue
  const totalRealizedProfit = metrics.realizedProfit + cementMetrics.realizedProfit

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-sm text-slate-500">Total Stock Value (CP)</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(totalStockValue)}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-500">Realized Profit (Total)</div>
          <div className="mt-1 text-2xl font-semibold">{formatMoney(totalRealizedProfit)}</div>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-bold uppercase tracking-wide">STOCK INVENTORY</div>
              <div className="text-sm text-slate-500">Manage stock by rod size</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Qty</div>
                <div className="mt-1 text-lg font-semibold">{formatNumber(metrics.totalQuantity)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Value (CP)</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(metrics.stockValue)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Profit</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(metrics.realizedProfit)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Low stock</div>
                <div className="mt-1 text-lg font-semibold">{formatNumber(metrics.lowStockCount)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {ROD_SIZES.map((size) => (
              <InventoryMobileCard
                key={size}
                size={size}
                onAdd={() => setDialog({ type: 'add', size })}
                onDeduct={() => setDialog({ type: 'deduct', size })}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-3 pr-4 font-medium">Size</th>
                  <th className="py-3 pr-4 font-medium">Qty</th>
                  <th className="py-3 pr-4 font-medium">Bundles</th>
                  <th className="py-3 pr-4 font-medium">CP (avg)</th>
                  <th className="py-3 pr-4 font-medium">SP</th>
                  <th className="py-3 pr-4 font-medium">Margin</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ROD_SIZES.map((size) => {
                  const item = items[size]
                  const margin = item.sellingPrice - item.averageCostPrice
                  const isLow = Math.round(item.bundles ?? 0) < item.lowStockThreshold

                  return (
                    <tr key={size} className="border-b border-slate-50">
                      <td className="py-4 pr-4">
                        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {size}
                        </div>
                      </td>
                      <td className="py-4 pr-4 font-medium">{formatNumber(item.quantity)}</td>
                      <td className="py-4 pr-4 font-medium">{formatNumber(item.bundles ?? 0)}</td>
                      <td className="py-4 pr-4">
                        <InlineMoneyField
                          key={`${size}-cp-${item.averageCostPrice}`}
                          value={item.averageCostPrice}
                          onCommit={(next) => setAverageCostPrice(size, next)}
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <InlineMoneyField
                          key={`${size}-sp-${item.sellingPrice}`}
                          value={item.sellingPrice}
                          onCommit={(next) => setSellingPrice(size, next)}
                        />
                      </td>
                      <td className="py-4 pr-4">{formatMoney(margin)}</td>
                      <td className="py-4 pr-4">
                        {isLow ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
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
      </div>

      <div className="grid gap-4">
        <Card>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">Cement Inventory</div>
              <div className="text-sm text-slate-500">Track cement bags and pricing</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Qty</div>
                <div className="mt-1 text-lg font-semibold">{formatNumber(cementMetrics.totalQuantity)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Value (CP)</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(cementMetrics.stockValue)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Profit</div>
                <div className="mt-1 text-lg font-semibold">{formatMoney(cementMetrics.realizedProfit)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-slate-500">Low stock</div>
                <div className="mt-1 text-lg font-semibold">{formatNumber(cementMetrics.lowStockCount)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {CEMENT_PRODUCTS.map((product) => (
              <CementMobileCard
                key={product}
                product={product}
                onAdd={() => setDialog({ type: 'cementAdd', product })}
                onDeduct={() => setDialog({ type: 'cementDeduct', product })}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-base">
              <thead className="text-sm text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="py-3 pr-4 font-medium">Product</th>
                  <th className="py-3 pr-4 font-medium">Qty</th>
                  <th className="py-3 pr-4 font-medium">CP (avg)</th>
                  <th className="py-3 pr-4 font-medium">SP</th>
                  <th className="py-3 pr-4 font-medium">Margin</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {CEMENT_PRODUCTS.map((product) => {
                  const item = cementItems[product]
                  const margin = item.sellingPrice - item.averageCostPrice
                  const isLow = item.quantity < item.lowStockThreshold

                  return (
                    <tr key={product} className="border-b border-slate-50">
                      <td className="py-4 pr-4">
                        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {product}
                        </div>
                      </td>
                      <td className="py-4 pr-4 font-medium">{formatNumber(item.quantity)}</td>
                      <td className="py-4 pr-4">
                        <InlineMoneyField
                          key={`${product}-cp-${item.averageCostPrice}`}
                          value={item.averageCostPrice}
                          onCommit={(next) => setCementAverageCostPrice(product, next)}
                        />
                      </td>
                      <td className="py-4 pr-4">
                        <InlineMoneyField
                          key={`${product}-sp-${item.sellingPrice}`}
                          value={item.sellingPrice}
                          onCommit={(next) => setCementSellingPrice(product, next)}
                        />
                      </td>
                      <td className="py-4 pr-4">{formatMoney(margin)}</td>
                      <td className="py-4 pr-4">
                        {isLow ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
                            Low stock
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setDialog({ type: 'cementAdd', product })}
                            type="button"
                          >
                            Add
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setDialog({ type: 'cementDeduct', product })}
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
      </div>

      <Suspense fallback={<div className="h-[320px] rounded-xl bg-white ring-1 ring-slate-200" />}>
        <ChartsPanel />
      </Suspense>

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

      {dialog.type === 'cementAdd' ? (
        <AddCementStockDialog
          product={dialog.product}
          onClose={() => setDialog({ type: 'none' })}
          onSubmit={(input) => addCementStock(input)}
        />
      ) : null}

      {dialog.type === 'cementDeduct' ? (
        <DeductCementStockDialog
          product={dialog.product}
          currentSellingPrice={cementItems[dialog.product].sellingPrice}
          onClose={() => setDialog({ type: 'none' })}
          onSubmit={(input) => deductCementStock(input)}
        />
      ) : null}
    </div>
  )
}

function InventoryMobileCard({
  size,
  onAdd,
  onDeduct,
}: {
  size: RodSize
  onAdd: () => void
  onDeduct: () => void
}) {
  const item = useInventoryStore((s) => s.items[size])
  const setAverageCostPrice = useInventoryStore((s) => s.setAverageCostPrice)
  const setSellingPrice = useInventoryStore((s) => s.setSellingPrice)

  const margin = item.sellingPrice - item.averageCostPrice
  const isLow = Math.round(item.bundles ?? 0) < item.lowStockThreshold

  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
          {size}
        </div>
        {isLow ? (
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
            Low stock
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
            OK
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-slate-500">Qty</div>
            <div className="mt-1 text-lg font-semibold">{formatNumber(item.quantity)}</div>
            <div className="mt-1 text-sm text-slate-500">Bundles: {formatNumber(item.bundles ?? 0)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Margin</div>
            <div className="mt-1 text-lg font-semibold">{formatMoney(margin)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">CP (avg)</div>
            <div className="mt-1">
              <InlineMoneyField
                key={`${size}-cp-mobile-${item.averageCostPrice}`}
                value={item.averageCostPrice}
                onCommit={(next) => setAverageCostPrice(size, next)}
              />
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">SP</div>
            <div className="mt-1">
              <InlineMoneyField
                key={`${size}-sp-mobile-${item.sellingPrice}`}
                value={item.sellingPrice}
                onCommit={(next) => setSellingPrice(size, next)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" type="button" onClick={onAdd}>
            Add
          </Button>
          <Button className="flex-1" variant="secondary" type="button" onClick={onDeduct}>
            Deduct
          </Button>
        </div>
      </div>
    </div>
  )
}

function CementMobileCard({
  product,
  onAdd,
  onDeduct,
}: {
  product: CementProduct
  onAdd: () => void
  onDeduct: () => void
}) {
  const item = useInventoryStore((s) => s.cementItems[product])
  const setAverageCostPrice = useInventoryStore((s) => s.setCementAverageCostPrice)
  const setSellingPrice = useInventoryStore((s) => s.setCementSellingPrice)

  const margin = item.sellingPrice - item.averageCostPrice
  const isLow = item.quantity < item.lowStockThreshold

  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
          {product}
        </div>
        {isLow ? (
          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-100">
            Low stock
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
            OK
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-slate-500">Qty</div>
            <div className="mt-1 text-lg font-semibold">{formatNumber(item.quantity)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Margin</div>
            <div className="mt-1 text-lg font-semibold">{formatMoney(margin)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">CP (avg)</div>
            <div className="mt-1">
              <InlineMoneyField
                key={`${product}-cp-mobile-${item.averageCostPrice}`}
                value={item.averageCostPrice}
                onCommit={(next) => setAverageCostPrice(product, next)}
              />
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">SP</div>
            <div className="mt-1">
              <InlineMoneyField
                key={`${product}-sp-mobile-${item.sellingPrice}`}
                value={item.sellingPrice}
                onCommit={(next) => setSellingPrice(product, next)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" type="button" onClick={onAdd}>
            Add
          </Button>
          <Button className="flex-1" variant="secondary" type="button" onClick={onDeduct}>
            Deduct
          </Button>
        </div>
      </div>
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
  onSubmit: (input: { size: RodSize; quantity: number; bundles?: number; unitCostPrice: number }) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [bundles, setBundles] = useState('')
  const [unitCostPrice, setUnitCostPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    setQuantity('')
    setBundles('')
    setUnitCostPrice('')
    onClose()
  }

  return (
    <Modal
      open
      size="xl"
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
              const bdls = Number(bundles)
              const cp = Number(unitCostPrice)
              if (!Number.isFinite(qty) || qty < 0) {
                setError('Enter a valid quantity.')
                return
              }
              if (!Number.isFinite(bdls) || bdls < 0) {
                setError('Enter a valid bundles value.')
                return
              }
              if (qty <= 0 && bdls <= 0) {
                setError('Enter quantity or bundles.')
                return
              }
              if (qty > 0 && (!Number.isFinite(cp) || cp < 0)) {
                setError('Enter a valid cost price.')
                return
              }
              setError(null)
              onSubmit({ size, quantity: qty, bundles: bdls, unitCostPrice: qty > 0 ? cp : 0 })
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
          <div className="text-sm font-medium text-slate-700">Quantity (kg)</div>
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
          <div className="text-sm font-medium text-slate-700">Bundles</div>
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            step="1"
            value={bundles}
            onChange={(e) => setBundles(e.target.value)}
            placeholder="e.g. 5"
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
    bundles?: number
    unitSellingPrice?: number
  }) => void
}) {
  const [quantity, setQuantity] = useState('')
  const [bundles, setBundles] = useState('')
  const [unitSellingPrice, setUnitSellingPrice] = useState(String(currentSellingPrice || 0))
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    setQuantity('')
    setBundles('')
    setUnitSellingPrice(String(currentSellingPrice || 0))
    onClose()
  }

  return (
    <Modal
      open
      size="xl"
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
              const bdls = Number(bundles)
              const sp = Number(unitSellingPrice)
              if (!Number.isFinite(qty) || qty < 0) {
                setError('Enter a valid quantity.')
                return
              }
              if (!Number.isFinite(bdls) || bdls < 0) {
                setError('Enter a valid bundles value.')
                return
              }
              if (qty <= 0 && bdls <= 0) {
                setError('Enter quantity or bundles.')
                return
              }
              if (qty > 0 && (!Number.isFinite(sp) || sp < 0)) {
                setError('Enter a valid selling price.')
                return
              }
              setError(null)
              try {
                onSubmit({ size, quantity: qty, bundles: bdls, unitSellingPrice: qty > 0 ? sp : 0 })
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
          <div className="text-sm font-medium text-slate-700">Quantity (kg)</div>
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
          <div className="text-sm font-medium text-slate-700">Bundles</div>
          <Input
            inputMode="numeric"
            type="number"
            min="0"
            step="1"
            value={bundles}
            onChange={(e) => setBundles(e.target.value)}
            placeholder="e.g. 1"
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

function AddCementStockDialog({
  product,
  onClose,
  onSubmit,
}: {
  product: CementProduct
  onClose: () => void
  onSubmit: (input: { product: CementProduct; quantity: number; unitCostPrice: number }) => void
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
      size="xl"
      title={`Add Stock • ${product}`}
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
              onSubmit({ product, quantity: qty, unitCostPrice: cp })
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
          <div className="text-sm font-medium text-slate-700">Quantity (bags)</div>
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
          <div className="text-sm font-medium text-slate-700">Cost Price (CP) per bag</div>
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

function DeductCementStockDialog({
  product,
  currentSellingPrice,
  onClose,
  onSubmit,
}: {
  product: CementProduct
  currentSellingPrice: number
  onClose: () => void
  onSubmit: (input: { product: CementProduct; quantity: number; unitSellingPrice?: number }) => void
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
      size="xl"
      title={`Deduct Stock • ${product}`}
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
                onSubmit({ product, quantity: qty, unitSellingPrice: sp })
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
          <div className="text-sm font-medium text-slate-700">Quantity (bags)</div>
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
          <div className="text-sm font-medium text-slate-700">Selling Price (SP) per bag</div>
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

function InlineMoneyField({
  value,
  onCommit,
}: {
  value: number
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setDraft(String(value))
    setError(null)
  }

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid price.')
      setDraft(String(value))
      return
    }
    setError(null)
    onCommit(parsed)
  }

  return (
    <div className="max-w-[160px]">
      <Input
        inputMode="decimal"
        type="number"
        step="0.01"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            ;(e.currentTarget as HTMLInputElement).blur()
            return
          }
          if (e.key === 'Escape') {
            reset()
          }
        }}
        className={[
          'min-h-11',
          error ? 'ring-2 ring-rose-200 focus:ring-rose-300' : '',
        ].join(' ')}
      />
      {error ? <div className="mt-1 text-sm text-rose-600">{error}</div> : null}
    </div>
  )
}

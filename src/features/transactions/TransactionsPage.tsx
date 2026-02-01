import { CEMENT_PRODUCTS, ROD_SIZES } from '../../domain/inventory'
import { Card } from '../../components/ui/Card'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatMoney, formatNumber } from '../../utils/format'

export function TransactionsPage() {
  const transactions = useInventoryStore((s) => s.transactions)
  const cementTransactions = useInventoryStore((s) => s.cementTransactions)

  const all = [
    ...transactions.map((t) => ({ kind: 'rod' as const, t })),
    ...cementTransactions.map((t) => ({ kind: 'cement' as const, t })),
  ].sort((a, b) => Number(new Date(b.t.createdAt)) - Number(new Date(a.t.createdAt)))

  return (
    <Card>
      <div className="mb-3">
        <div className="text-base font-semibold">Transactions</div>
        <div className="text-sm text-slate-500">All stock adds and sales (rods + cement)</div>
      </div>

      <div className="space-y-3 lg:hidden">
        {all.map(({ kind, t }) => (
          <div key={`${kind}:${t.id}`} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={[
                  'inline-flex rounded-full px-3 py-1 text-sm font-medium ring-1',
                  t.type === 'SALE'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                    : 'bg-white text-slate-700 ring-slate-200',
                ].join(' ')}
              >
                {t.type}
              </span>
              <div className="text-sm text-slate-500">{new Date(t.createdAt).toLocaleString()}</div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-slate-500">Item</div>
                  <div className="mt-1 text-base font-semibold">
                    {kind === 'rod' ? t.size : t.product}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Qty</div>
                  <div className="mt-1 text-base font-semibold">{formatNumber(t.quantity)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-slate-500">Unit Cost</div>
                  <div className="mt-1 text-base font-semibold">
                    {t.unitCost == null ? '—' : formatMoney(t.unitCost)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-500">Unit Price</div>
                  <div className="mt-1 text-base font-semibold">
                    {t.unitPrice == null ? '—' : formatMoney(t.unitPrice)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm text-slate-500">Bundles</div>
              <div className="mt-1 text-base font-semibold">
                {kind === 'rod' ? formatNumber(t.bundles ?? 0) : '—'}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm text-slate-500">Profit</div>
              <div className="mt-1 text-base font-semibold">
                {t.type === 'SALE' ? formatMoney(t.profit) : '—'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-base">
          <thead className="text-sm text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="py-3 pr-4 font-medium">Date</th>
              <th className="py-3 pr-4 font-medium">Type</th>
              <th className="py-3 pr-4 font-medium">Item</th>
              <th className="py-3 pr-4 font-medium">Qty</th>
              <th className="py-3 pr-4 font-medium">Bundles</th>
              <th className="py-3 pr-4 font-medium">Unit Cost</th>
              <th className="py-3 pr-4 font-medium">Unit Price</th>
              <th className="py-3 pr-4 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {all.map(({ kind, t }) => (
              <tr key={`${kind}:${t.id}`} className="border-b border-slate-50">
                <td className="py-4 pr-4 text-sm text-slate-600">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
                <td className="py-4 pr-4">
                  <span
                    className={[
                      'inline-flex rounded-full px-3 py-1 text-sm font-medium ring-1',
                      t.type === 'SALE'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                        : 'bg-slate-50 text-slate-700 ring-slate-200',
                    ].join(' ')}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="py-4 pr-4">{kind === 'rod' ? t.size : t.product}</td>
                <td className="py-4 pr-4">{formatNumber(t.quantity)}</td>
                <td className="py-4 pr-4">{kind === 'rod' ? formatNumber(t.bundles ?? 0) : '—'}</td>
                <td className="py-4 pr-4">{t.unitCost == null ? '—' : formatMoney(t.unitCost)}</td>
                <td className="py-4 pr-4">
                  {t.unitPrice == null ? '—' : formatMoney(t.unitPrice)}
                </td>
                <td className="py-4 pr-4">{t.type === 'SALE' ? formatMoney(t.profit) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {all.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          No transactions yet.
        </div>
      ) : null}

      <div className="mt-4 text-sm text-slate-500">
        Rod sizes: {ROD_SIZES.join(', ')} • Cement: {CEMENT_PRODUCTS.join(', ')}
      </div>
    </Card>
  )
}

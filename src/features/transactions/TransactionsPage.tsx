import { ROD_SIZES } from '../../domain/inventory'
import { Card } from '../../components/ui/Card'
import { useInventoryStore } from '../../store/inventoryStore'
import { formatMoney, formatNumber } from '../../utils/format'

export function TransactionsPage() {
  const transactions = useInventoryStore((s) => s.transactions)

  return (
    <Card>
      <div className="mb-3">
        <div className="text-base font-semibold">Transactions</div>
        <div className="text-sm text-slate-500">All stock adds and sales</div>
      </div>

      <div className="space-y-3 lg:hidden">
        {transactions.map((t) => (
          <div key={t.id} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
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
                  <div className="text-sm text-slate-500">Size</div>
                  <div className="mt-1 text-base font-semibold">{t.size}</div>
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
              <th className="py-3 pr-4 font-medium">Size</th>
              <th className="py-3 pr-4 font-medium">Qty</th>
              <th className="py-3 pr-4 font-medium">Unit Cost</th>
              <th className="py-3 pr-4 font-medium">Unit Price</th>
              <th className="py-3 pr-4 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-slate-50">
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
                <td className="py-4 pr-4">{t.size}</td>
                <td className="py-4 pr-4">{formatNumber(t.quantity)}</td>
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

      {transactions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
          No transactions yet.
        </div>
      ) : null}

      <div className="mt-4 text-sm text-slate-500">
        Sizes tracked: {ROD_SIZES.join(', ')}
      </div>
    </Card>
  )
}

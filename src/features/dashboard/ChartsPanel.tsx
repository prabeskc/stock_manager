import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ROD_SIZES } from '../../domain/inventory'
import { useInventoryStore } from '../../store/inventoryStore'
import { Card } from '../../components/ui/Card'
import { formatMoney, formatNumber } from '../../utils/format'

export function ChartsPanel() {
  const items = useInventoryStore((s) => s.items)
  const transactions = useInventoryStore((s) => s.transactions)

  const stockData = useMemo(
    () =>
      ROD_SIZES.map((size) => ({
        size,
        quantity: items[size].quantity,
      })),
    [items],
  )

  const profitData = useMemo(() => {
    const sales = transactions.filter((t) => t.type === 'SALE').slice(0, 14).reverse()
    return sales.map((t) => ({
      label: new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
      profit: t.profit,
    }))
  }, [transactions])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Stock by Size</div>
          <div className="text-xs text-slate-500">Current quantity (pcs)</div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stockData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="size" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value) => [formatNumber(Number(value)), 'Qty']}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
              <Bar dataKey="quantity" fill="#0f172a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <div className="text-sm font-semibold">Profit Trend</div>
          <div className="text-xs text-slate-500">Recent sales profit</div>
        </div>
        {profitData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No sales yet. Profit will appear here after you deduct stock as a sale.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), 'Profit']}
                  contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}


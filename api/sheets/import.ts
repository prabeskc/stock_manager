import { createSheetsClient, ensureSheetsExist, readValues } from '../_lib/googleSheets.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { assertValidSyncToken, HttpError } from '../_lib/syncAuth.js'

const ROD_SIZES = ['8mm', '10mm', '12mm'] as const

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    assertValidSyncToken(req)

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Items', 'Transactions'] })

    const itemsValues = await readValues({ sheets, spreadsheetId, range: 'Items!A2:E' })
    const transactionsValues = await readValues({
      sheets,
      spreadsheetId,
      range: 'Transactions!A2:H',
    })

    const items: Record<
      string,
      {
        quantity: number
        averageCostPrice: number
        sellingPrice: number
        lowStockThreshold: number
      }
    > = {}
    for (const size of ROD_SIZES) {
      items[size] = { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 }
    }

    for (const row of itemsValues) {
      const [size, quantity, averageCostPrice, sellingPrice, lowStockThreshold] = row
      const key = toString(size)
      if (!ROD_SIZES.includes(key as (typeof ROD_SIZES)[number])) continue
      items[key] = {
        quantity: Math.round(toNumber(quantity)),
        averageCostPrice: toNumber(averageCostPrice),
        sellingPrice: toNumber(sellingPrice),
        lowStockThreshold: Math.round(toNumber(lowStockThreshold)),
      }
    }

    const transactions = transactionsValues
      .filter((row) => row.length > 0 && row.some((v) => v !== '' && v != null))
      .map((row) => {
        const [id, type, size, quantity, unitCost, unitPrice, profit, createdAt] = row
        return {
          id: toString(id),
          type: toString(type),
          size: toString(size),
          quantity: Math.round(toNumber(quantity)),
          unitCost: unitCost === '' || unitCost == null ? null : toNumber(unitCost),
          unitPrice: unitPrice === '' || unitPrice == null ? null : toNumber(unitPrice),
          profit: toNumber(profit),
          createdAt: toString(createdAt),
        }
      })

    res.status(200).json({ ok: true, data: { items, transactions } })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({
      error: e instanceof Error ? e.message : 'Server error',
    })
  }
}


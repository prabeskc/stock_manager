import { createSheetsClient, ensureSheetsExist, writeValues } from '../_lib/googleSheets'
import type { ApiRequest, ApiResponse } from '../_lib/http'
import { assertValidSyncToken, HttpError } from '../_lib/syncAuth'

type ExportBody = {
  items: Record<string, unknown>
  transactions: unknown
}

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
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    assertValidSyncToken(req)

    const body = req.body as ExportBody
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Items', 'Transactions'] })

    const itemsRecord =
      body.items && typeof body.items === 'object' ? (body.items as Record<string, unknown>) : {}

    const itemsRows: (string | number)[][] = [
      ['size', 'quantity', 'averageCostPrice', 'sellingPrice', 'lowStockThreshold'],
      ...ROD_SIZES.map((size) => {
        const maybeItem = itemsRecord[size]
        const item =
          maybeItem && typeof maybeItem === 'object'
            ? (maybeItem as Record<string, unknown>)
            : {}
        return [
          size,
          toNumber(item.quantity),
          toNumber(item.averageCostPrice),
          toNumber(item.sellingPrice),
          Math.round(toNumber(item.lowStockThreshold)),
        ]
      }),
    ]

    const txs = Array.isArray(body.transactions) ? body.transactions : []
    const txRows: (string | number | null)[][] = [
      ['id', 'type', 'size', 'quantity', 'unitCost', 'unitPrice', 'profit', 'createdAt'],
      ...txs.map((t) => {
        const tx = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
        const unitCost = tx.unitCost
        const unitPrice = tx.unitPrice

        return [
          toString(tx.id),
          toString(tx.type),
          toString(tx.size),
          toNumber(tx.quantity),
          unitCost == null ? null : toNumber(unitCost),
          unitPrice == null ? null : toNumber(unitPrice),
          toNumber(tx.profit),
          toString(tx.createdAt),
        ]
      }),
    ]

    await writeValues({ sheets, spreadsheetId, range: 'Items!A1', values: itemsRows })
    await writeValues({ sheets, spreadsheetId, range: 'Transactions!A1', values: txRows })

    res
      .status(200)
      .json({ ok: true, exported: { items: ROD_SIZES.length, transactions: txs.length } })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({
      error: e instanceof Error ? e.message : 'Server error',
    })
  }
}


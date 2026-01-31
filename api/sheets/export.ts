import { createSheetsClient, ensureSheetsExist, readValues, writeValues } from '../_lib/googleSheets.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { assertValidSyncToken, HttpError } from '../_lib/syncAuth.js'

type ExportBody = {
  items: Record<string, unknown>
  transactions: unknown
  cementItems?: Record<string, unknown>
  cementTransactions?: unknown
}

const ROD_SIZES = ['8mm', '10mm', '12mm'] as const
const CEMENT_PRODUCTS = ['PPC', 'OPC'] as const

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}

function getUpdatedAt(values: (string | number)[][]): string | null {
  for (const row of values) {
    const key = row[0]
    const value = row[1]
    if (key === 'updatedAt' && typeof value === 'string') return value
  }
  return null
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    res.setHeader?.('cache-control', 'no-store')
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
    await ensureSheetsExist({
      sheets,
      spreadsheetId,
      sheetTitles: ['Items', 'Transactions', 'CementTransactions', 'Meta'],
    })

    const itemsRecord =
      body.items && typeof body.items === 'object' ? (body.items as Record<string, unknown>) : {}

    const cementItemsRecord =
      body.cementItems && typeof body.cementItems === 'object'
        ? (body.cementItems as Record<string, unknown>)
        : {}

    const inventoryRows: (string | number)[][] = [
      ['Iron Rod', 'quantity', 'averageCostPrice', 'sellingPrice', 'lowStockThreshold'],
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
      ['', '', '', '', ''],
      ['Cement', 'quantity', 'averageCostPrice', 'sellingPrice', 'lowStockThreshold'],
      ...CEMENT_PRODUCTS.map((product) => {
        const maybeItem = cementItemsRecord[product]
        const item =
          maybeItem && typeof maybeItem === 'object'
            ? (maybeItem as Record<string, unknown>)
            : {}
        return [
          product,
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

    await writeValues({ sheets, spreadsheetId, range: 'Items!A1', values: inventoryRows })
    await writeValues({ sheets, spreadsheetId, range: 'Transactions!A1', values: txRows })

    const cementTxs = Array.isArray(body.cementTransactions) ? body.cementTransactions : []
    const cementTxRows: (string | number | null)[][] = [
      ['id', 'type', 'product', 'quantity', 'unitCost', 'unitPrice', 'profit', 'createdAt'],
      ...cementTxs.map((t) => {
        const tx = t && typeof t === 'object' ? (t as Record<string, unknown>) : {}
        const unitCost = tx.unitCost
        const unitPrice = tx.unitPrice

        return [
          toString(tx.id),
          toString(tx.type),
          toString(tx.product),
          toNumber(tx.quantity),
          unitCost == null ? null : toNumber(unitCost),
          unitPrice == null ? null : toNumber(unitPrice),
          toNumber(tx.profit),
          toString(tx.createdAt),
        ]
      }),
    ]

    await writeValues({ sheets, spreadsheetId, range: 'CementTransactions!A1', values: cementTxRows })

    const updatedAt = new Date().toISOString()
    await writeValues({
      sheets,
      spreadsheetId,
      range: 'Meta!A1',
      values: [
        ['key', 'value'],
        ['updatedAt', updatedAt],
      ],
    })

    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })
    const confirmedUpdatedAt = getUpdatedAt(metaValues) ?? updatedAt

    res.status(200).json({
      ok: true,
      exported: {
        items: ROD_SIZES.length,
        transactions: txs.length,
        cementItems: CEMENT_PRODUCTS.length,
        cementTransactions: cementTxs.length,
      },
      meta: { updatedAt: confirmedUpdatedAt },
    })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({
      error: e instanceof Error ? e.message : 'Server error',
    })
  }
}


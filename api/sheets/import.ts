import { createSheetsClient, ensureSheetsExist, readValues } from '../_lib/googleSheets.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { assertValidSyncToken, HttpError } from '../_lib/syncAuth.js'

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
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    assertValidSyncToken(req)

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({
      sheets,
      spreadsheetId,
      sheetTitles: ['Items', 'Transactions', 'CementTransactions', 'Meta'],
    })

    const itemsAll = await readValues({ sheets, spreadsheetId, range: 'Items!A1:E50' })
    const transactionsValues = await readValues({
      sheets,
      spreadsheetId,
      range: 'Transactions!A2:H',
    })
    const cementTransactionsValues = await readValues({
      sheets,
      spreadsheetId,
      range: 'CementTransactions!A2:H',
    })
    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })
    const updatedAt = getUpdatedAt(metaValues)

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

    const firstRow = itemsAll[0] ?? []
    const looksLikeSectionedLayout =
      toString(firstRow[0]) === 'Iron Rod' && toString(firstRow[1]) === 'quantity'

    if (looksLikeSectionedLayout) {
      for (let i = 1; i < itemsAll.length; i++) {
        const row = itemsAll[i] ?? []
        const firstCell = toString(row[0])
        if (firstCell === 'Cement') break
        if (!firstCell) continue
        if (!ROD_SIZES.includes(firstCell as (typeof ROD_SIZES)[number])) continue
        const [, quantity, averageCostPrice, sellingPrice, lowStockThreshold] = row
        items[firstCell] = {
          quantity: Math.round(toNumber(quantity)),
          averageCostPrice: toNumber(averageCostPrice),
          sellingPrice: toNumber(sellingPrice),
          lowStockThreshold: Math.round(toNumber(lowStockThreshold)),
        }
      }
    } else {
      const itemsValues = itemsAll.slice(1)
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

    const cementItems: Record<
      string,
      { quantity: number; averageCostPrice: number; sellingPrice: number; lowStockThreshold: number }
    > = {}
    for (const product of CEMENT_PRODUCTS) {
      cementItems[product] = {
        quantity: 0,
        averageCostPrice: 0,
        sellingPrice: 0,
        lowStockThreshold: 10,
      }
    }

    if (looksLikeSectionedLayout) {
      const cementHeaderIndex = itemsAll.findIndex((row) => toString(row?.[0]) === 'Cement')
      if (cementHeaderIndex >= 0) {
        for (let i = cementHeaderIndex + 1; i < itemsAll.length; i++) {
          const row = itemsAll[i] ?? []
          const product = toString(row[0])
          if (!product) continue
          if (!CEMENT_PRODUCTS.includes(product as (typeof CEMENT_PRODUCTS)[number])) continue
          const [, quantity, averageCostPrice, sellingPrice, lowStockThreshold] = row
          cementItems[product] = {
            quantity: Math.round(toNumber(quantity)),
            averageCostPrice: toNumber(averageCostPrice),
            sellingPrice: toNumber(sellingPrice),
            lowStockThreshold: Math.round(toNumber(lowStockThreshold)),
          }
        }
      }
    }

    const cementTransactions = cementTransactionsValues
      .filter((row) => row.length > 0 && row.some((v) => v !== '' && v != null))
      .map((row) => {
        const [id, type, product, quantity, unitCost, unitPrice, profit, createdAt] = row
        return {
          id: toString(id),
          type: toString(type),
          product: toString(product),
          quantity: Math.round(toNumber(quantity)),
          unitCost: unitCost === '' || unitCost == null ? null : toNumber(unitCost),
          unitPrice: unitPrice === '' || unitPrice == null ? null : toNumber(unitPrice),
          profit: toNumber(profit),
          createdAt: toString(createdAt),
        }
      })

    res.status(200).json({
      ok: true,
      data: { items, transactions, cementItems, cementTransactions },
      meta: { updatedAt },
    })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({
      error: e instanceof Error ? e.message : 'Server error',
    })
  }
}


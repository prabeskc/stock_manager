import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createSheetsClient, ensureSheetsExist, readValues, writeValues } from '../api/_lib/googleSheets'
import { assertValidSyncToken, HttpError } from '../api/_lib/syncAuth'

dotenv.config({ path: '.env.local' })

const PORT = Number(process.env.PORT ?? 8787)
const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

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

function requireSyncToken(req: express.Request) {
  assertValidSyncToken({
    headers: req.headers as unknown as Record<string, string | string[] | undefined>,
  })
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.get('/api/sheets/import', async (req, res) => {
  try {
    requireSyncToken(req)

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({
      sheets,
      spreadsheetId,
      sheetTitles: ['Items', 'Transactions', 'CementTransactions', 'Meta'],
    })

    const itemsAll = await readValues({ sheets, spreadsheetId, range: 'Items!A1:E50' })
    const transactionsValues = await readValues({ sheets, spreadsheetId, range: 'Transactions!A2:H' })
    const cementTransactionsValues = await readValues({
      sheets,
      spreadsheetId,
      range: 'CementTransactions!A2:H',
    })
    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })
    const updatedAt = getUpdatedAt(metaValues)

    const items: Record<
      string,
      { quantity: number; averageCostPrice: number; sellingPrice: number; lowStockThreshold: number }
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
    res.status(statusCode).json({ error: e instanceof Error ? e.message : 'Server error' })
  }
})

app.get('/api/sheets/meta', async (req, res) => {
  try {
    requireSyncToken(req)
    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Meta'] })
    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })
    res.status(200).json({ ok: true, meta: { updatedAt: getUpdatedAt(metaValues) } })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({ error: e instanceof Error ? e.message : 'Server error' })
  }
})

app.post('/api/sheets/export', async (req, res) => {
  try {
    requireSyncToken(req)

    const body = req.body as {
      items?: unknown
      transactions?: unknown
      cementItems?: unknown
      cementTransactions?: unknown
    }
    const itemsRecord =
      body.items && typeof body.items === 'object' ? (body.items as Record<string, unknown>) : {}

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

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({
      sheets,
      spreadsheetId,
      sheetTitles: ['Items', 'Transactions', 'CementTransactions', 'Meta'],
    })
    await writeValues({ sheets, spreadsheetId, range: 'Items!A1', values: inventoryRows })
    await writeValues({ sheets, spreadsheetId, range: 'Transactions!A1', values: txRows })
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

    res.status(200).json({
      ok: true,
      exported: {
        items: ROD_SIZES.length,
        transactions: txs.length,
        cementItems: CEMENT_PRODUCTS.length,
        cementTransactions: cementTxs.length,
      },
      meta: { updatedAt },
    })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({ error: e instanceof Error ? e.message : 'Server error' })
  }
})

app.listen(PORT, () => {
})

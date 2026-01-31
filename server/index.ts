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
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Items', 'Transactions', 'Meta'] })

    const itemsValues = await readValues({ sheets, spreadsheetId, range: 'Items!A2:E' })
    const transactionsValues = await readValues({ sheets, spreadsheetId, range: 'Transactions!A2:H' })
    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })
    const updatedAt = getUpdatedAt(metaValues)

    const items: Record<
      string,
      { quantity: number; averageCostPrice: number; sellingPrice: number; lowStockThreshold: number }
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

    res.status(200).json({ ok: true, data: { items, transactions }, meta: { updatedAt } })
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

    const body = req.body as { items?: unknown; transactions?: unknown }
    const itemsRecord =
      body.items && typeof body.items === 'object' ? (body.items as Record<string, unknown>) : {}

    const txs = Array.isArray(body.transactions) ? body.transactions : []

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

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Items', 'Transactions', 'Meta'] })
    await writeValues({ sheets, spreadsheetId, range: 'Items!A1', values: itemsRows })
    await writeValues({ sheets, spreadsheetId, range: 'Transactions!A1', values: txRows })

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
      exported: { items: ROD_SIZES.length, transactions: txs.length },
      meta: { updatedAt },
    })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({ error: e instanceof Error ? e.message : 'Server error' })
  }
})

app.listen(PORT, () => {
})

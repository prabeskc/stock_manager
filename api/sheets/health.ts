import { createSheetsClient, ensureSheetsExist, readValues } from '../_lib/googleSheets.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { assertValidSyncToken, HttpError } from '../_lib/syncAuth.js'

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

    const config = {
      hasSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
      hasClientEmail: Boolean(process.env.GOOGLE_CLIENT_EMAIL),
      hasPrivateKey: Boolean(process.env.GOOGLE_PRIVATE_KEY),
      hasSyncToken: Boolean(process.env.SHEETS_SYNC_TOKEN),
    }

    const { sheets, spreadsheetId } = createSheetsClient()
    await ensureSheetsExist({ sheets, spreadsheetId, sheetTitles: ['Meta'] })
    const metaValues = await readValues({ sheets, spreadsheetId, range: 'Meta!A2:B10' })

    res.status(200).json({
      ok: true,
      serverTime: new Date().toISOString(),
      config,
      meta: { updatedAt: getUpdatedAt(metaValues) },
    })
  } catch (e) {
    const statusCode = e instanceof HttpError ? e.statusCode : 500
    res.status(statusCode).json({
      error: e instanceof Error ? e.message : 'Server error',
    })
  }
}


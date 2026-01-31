import { google, type sheets_v4 } from 'googleapis'

export type GoogleSheetsClient = sheets_v4.Sheets

export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export function createSheetsClient(): { sheets: GoogleSheetsClient; spreadsheetId: string } {
  const spreadsheetId = getRequiredEnv('GOOGLE_SHEET_ID')
  const clientEmail = getRequiredEnv('GOOGLE_CLIENT_EMAIL')
  const rawPrivateKey = getRequiredEnv('GOOGLE_PRIVATE_KEY')
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n')

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return { sheets, spreadsheetId }
}

export async function ensureSheetsExist(params: {
  sheets: GoogleSheetsClient
  spreadsheetId: string
  sheetTitles: string[]
}) {
  const spreadsheet = await params.sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
  })

  const existing = new Set(
    (spreadsheet.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  )

  const missing = params.sheetTitles.filter((t) => !existing.has(t))
  if (missing.length === 0) return

  await params.sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    },
  })
}

export async function writeValues(params: {
  sheets: GoogleSheetsClient
  spreadsheetId: string
  range: string
  values: (string | number | null)[][]
}) {
  await params.sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: 'RAW',
    requestBody: { values: params.values },
  })
}

export async function readValues(params: {
  sheets: GoogleSheetsClient
  spreadsheetId: string
  range: string
}): Promise<(string | number)[][]> {
  const res = await params.sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })

  const values = res.data.values ?? []
  return values as (string | number)[][]
}

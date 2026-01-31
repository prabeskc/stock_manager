import type { ApiRequest } from './http.js'

export class HttpError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }
}

function getHeader(req: ApiRequest, name: string): string | null {
  const headers = req.headers ?? {}
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  if (!key) return null
  const value = headers[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function assertValidSyncToken(req: ApiRequest) {
  const expected = process.env.SHEETS_SYNC_TOKEN
  if (!expected) {
    throw new HttpError('Missing environment variable: SHEETS_SYNC_TOKEN', 500)
  }

  const provided = getHeader(req, 'x-sync-token')
  if (!provided || provided !== expected) {
    throw new HttpError('Unauthorized', 401)
  }
}

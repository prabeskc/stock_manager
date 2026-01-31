export type ApiRequest = {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (data: unknown) => void
  setHeader?: (name: string, value: string) => void
}

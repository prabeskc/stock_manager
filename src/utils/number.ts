export function toNonNegativeNumber(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

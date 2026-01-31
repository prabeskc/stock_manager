export const ROD_SIZES = ['8mm', '10mm', '12mm'] as const

export type RodSize = (typeof ROD_SIZES)[number]

export type InventoryItem = {
  quantity: number
  averageCostPrice: number
  sellingPrice: number
  lowStockThreshold: number
}

export type InventoryTransactionType = 'ADD' | 'SALE'

export type InventoryTransaction = {
  id: string
  type: InventoryTransactionType
  size: RodSize
  quantity: number
  unitCost: number | null
  unitPrice: number | null
  profit: number
  createdAt: string
}

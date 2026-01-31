import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { InventoryItem, InventoryTransaction, RodSize } from '../domain/inventory'
import { createId } from '../utils/id'
import {
  computeSaleProfit,
  computeWeightedAverageCostPrice,
} from '../utils/inventoryMath'
import { roundMoney, toNonNegativeNumber } from '../utils/number'

type InventoryItems = Record<RodSize, InventoryItem>

type AddStockInput = {
  size: RodSize
  quantity: number
  unitCostPrice: number
}

type DeductStockInput = {
  size: RodSize
  quantity: number
  unitSellingPrice?: number
}

export type InventoryStoreState = {
  items: InventoryItems
  transactions: InventoryTransaction[]
  addStock: (input: AddStockInput) => void
  deductStock: (input: DeductStockInput) => void
  setAverageCostPrice: (size: RodSize, averageCostPrice: number) => void
  setSellingPrice: (size: RodSize, unitSellingPrice: number) => void
  setLowStockThreshold: (size: RodSize, lowStockThreshold: number) => void
  setAll: (data: { items: InventoryItems; transactions: InventoryTransaction[] }) => void
  reset: () => void
}

const defaultItems: InventoryItems = {
  '8mm': { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
  '10mm': { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
  '12mm': { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
}

const STORAGE_KEY = 'hardware-stock-manager:v1'
const MAX_TRANSACTIONS = 500

export const useInventoryStore = create<InventoryStoreState>()(
  persist(
    (set, get) => ({
      items: defaultItems,
      transactions: [],
      addStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        const unitCostPrice = roundMoney(input.unitCostPrice)
        if (quantity === 0) return

        set((state) => {
          const currentItem = state.items[input.size]
          const nextQuantity = currentItem.quantity + quantity
          const nextAverageCostPrice = computeWeightedAverageCostPrice({
            currentQuantity: currentItem.quantity,
            currentAverageCostPrice: currentItem.averageCostPrice,
            addedQuantity: quantity,
            addedUnitCostPrice: unitCostPrice,
          })

          const transaction: InventoryTransaction = {
            id: createId(),
            type: 'ADD',
            size: input.size,
            quantity,
            unitCost: unitCostPrice,
            unitPrice: null,
            profit: 0,
            createdAt: new Date().toISOString(),
          }

          const transactions = [transaction, ...state.transactions].slice(
            0,
            MAX_TRANSACTIONS,
          )

          return {
            items: {
              ...state.items,
              [input.size]: {
                ...currentItem,
                quantity: nextQuantity,
                averageCostPrice: nextAverageCostPrice,
              },
            },
            transactions,
          }
        })
      },
      deductStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        if (quantity === 0) return

        const currentItem = get().items[input.size]
        if (quantity > currentItem.quantity) {
          throw new Error('Cannot deduct more stock than available.')
        }

        const unitSellingPrice = roundMoney(
          input.unitSellingPrice ?? currentItem.sellingPrice,
        )
        const unitCostPrice = currentItem.averageCostPrice
        const profit = computeSaleProfit({
          quantity,
          unitSellingPrice,
          unitCostPrice,
        })

        set((state) => {
          const transaction: InventoryTransaction = {
            id: createId(),
            type: 'SALE',
            size: input.size,
            quantity,
            unitCost: unitCostPrice,
            unitPrice: unitSellingPrice,
            profit,
            createdAt: new Date().toISOString(),
          }

          const transactions = [transaction, ...state.transactions].slice(
            0,
            MAX_TRANSACTIONS,
          )

          return {
            items: {
              ...state.items,
              [input.size]: {
                ...state.items[input.size],
                quantity: state.items[input.size].quantity - quantity,
                sellingPrice: unitSellingPrice,
              },
            },
            transactions,
          }
        })
      },
      setAverageCostPrice: (size, averageCostPrice) => {
        const value = roundMoney(averageCostPrice)
        set((state) => ({
          items: {
            ...state.items,
            [size]: { ...state.items[size], averageCostPrice: value },
          },
        }))
      },
      setSellingPrice: (size, unitSellingPrice) => {
        const value = roundMoney(unitSellingPrice)
        set((state) => ({
          items: { ...state.items, [size]: { ...state.items[size], sellingPrice: value } },
        }))
      },
      setLowStockThreshold: (size, lowStockThreshold) => {
        const value = Math.round(toNonNegativeNumber(lowStockThreshold))
        set((state) => ({
          items: {
            ...state.items,
            [size]: { ...state.items[size], lowStockThreshold: value },
          },
        }))
      },
      setAll: (data) => {
        const nextItems: InventoryItems = {
          '8mm': { ...defaultItems['8mm'], ...(data.items['8mm'] ?? {}) },
          '10mm': { ...defaultItems['10mm'], ...(data.items['10mm'] ?? {}) },
          '12mm': { ...defaultItems['12mm'], ...(data.items['12mm'] ?? {}) },
        }

        const nextTransactions = (Array.isArray(data.transactions) ? data.transactions : []).slice(
          0,
          MAX_TRANSACTIONS,
        )

        set({ items: nextItems, transactions: nextTransactions })
      },
      reset: () => {
        set({ items: defaultItems, transactions: [] })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ items: state.items, transactions: state.transactions }),
    },
  ),
)

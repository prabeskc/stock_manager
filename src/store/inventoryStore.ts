import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  CementProduct,
  CementTransaction,
  InventoryItem,
  InventoryTransaction,
  RodSize,
} from '../domain/inventory'
import { createId } from '../utils/id'
import {
  computeSaleProfit,
  computeWeightedAverageCostPrice,
} from '../utils/inventoryMath'
import { roundMoney, toNonNegativeNumber } from '../utils/number'

type InventoryItems = Record<RodSize, InventoryItem>
type CementItems = Record<CementProduct, InventoryItem>

type AddStockInput = {
  size: RodSize
  quantity: number
  bundles?: number
  unitCostPrice: number
}

type DeductStockInput = {
  size: RodSize
  quantity: number
  bundles?: number
  unitSellingPrice?: number
}

type AddCementStockInput = {
  product: CementProduct
  quantity: number
  unitCostPrice: number
}

type DeductCementStockInput = {
  product: CementProduct
  quantity: number
  unitSellingPrice?: number
}

export type InventoryStoreState = {
  items: InventoryItems
  transactions: InventoryTransaction[]
  cementItems: CementItems
  cementTransactions: CementTransaction[]
  addStock: (input: AddStockInput) => void
  deductStock: (input: DeductStockInput) => void
  addCementStock: (input: AddCementStockInput) => void
  deductCementStock: (input: DeductCementStockInput) => void
  setAverageCostPrice: (size: RodSize, averageCostPrice: number) => void
  setSellingPrice: (size: RodSize, unitSellingPrice: number) => void
  setLowStockThreshold: (size: RodSize, lowStockThreshold: number) => void
  setCementAverageCostPrice: (product: CementProduct, averageCostPrice: number) => void
  setCementSellingPrice: (product: CementProduct, unitSellingPrice: number) => void
  setCementLowStockThreshold: (product: CementProduct, lowStockThreshold: number) => void
  setAll: (data: {
    items: InventoryItems
    transactions: InventoryTransaction[]
    cementItems?: CementItems
    cementTransactions?: CementTransaction[]
  }) => void
  reset: () => void
}

const defaultItems: InventoryItems = {
  '8mm': { quantity: 0, bundles: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
  '10mm': { quantity: 0, bundles: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
  '12mm': { quantity: 0, bundles: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
}

const defaultCementItems: CementItems = {
  PPC: { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
  OPC: { quantity: 0, averageCostPrice: 0, sellingPrice: 0, lowStockThreshold: 10 },
}

const STORAGE_KEY = 'hardware-stock-manager:v1'
const MAX_TRANSACTIONS = 500

export const useInventoryStore = create<InventoryStoreState>()(
  persist(
    (set, get) => ({
      items: defaultItems,
      transactions: [],
      cementItems: defaultCementItems,
      cementTransactions: [],
      addStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        const bundles = Math.round(toNonNegativeNumber(input.bundles ?? 0))
        const unitCostPrice = roundMoney(input.unitCostPrice)
        if (quantity === 0 && bundles === 0) return

        set((state) => {
          const currentItem = state.items[input.size]
          const nextQuantity = currentItem.quantity + quantity
          const nextAverageCostPrice = computeWeightedAverageCostPrice({
            currentQuantity: currentItem.quantity,
            currentAverageCostPrice: currentItem.averageCostPrice,
            addedQuantity: quantity,
            addedUnitCostPrice: unitCostPrice,
          })
          const currentBundles = Math.round(toNonNegativeNumber(currentItem.bundles ?? 0))
          const nextBundles = currentBundles + bundles

          const transaction: InventoryTransaction = {
            id: createId(),
            type: 'ADD',
            size: input.size,
            quantity,
            bundles,
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
                bundles: nextBundles,
                averageCostPrice: nextAverageCostPrice,
              },
            },
            transactions,
          }
        })
      },
      deductStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        const bundles = Math.round(toNonNegativeNumber(input.bundles ?? 0))
        if (quantity === 0 && bundles === 0) return

        const currentItem = get().items[input.size]
        if (quantity > currentItem.quantity) {
          throw new Error('Cannot deduct more stock than available.')
        }
        const currentBundles = Math.round(toNonNegativeNumber(currentItem.bundles ?? 0))
        if (bundles > currentBundles) {
          throw new Error('Cannot deduct more bundles than available.')
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
            bundles,
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
                bundles:
                  Math.round(toNonNegativeNumber(state.items[input.size].bundles ?? 0)) - bundles,
                sellingPrice: unitSellingPrice,
              },
            },
            transactions,
          }
        })
      },
      addCementStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        const unitCostPrice = roundMoney(input.unitCostPrice)
        if (quantity === 0) return

        set((state) => {
          const currentItem = state.cementItems[input.product]
          const nextQuantity = currentItem.quantity + quantity
          const nextAverageCostPrice = computeWeightedAverageCostPrice({
            currentQuantity: currentItem.quantity,
            currentAverageCostPrice: currentItem.averageCostPrice,
            addedQuantity: quantity,
            addedUnitCostPrice: unitCostPrice,
          })

          const transaction: CementTransaction = {
            id: createId(),
            type: 'ADD',
            product: input.product,
            quantity,
            unitCost: unitCostPrice,
            unitPrice: null,
            profit: 0,
            createdAt: new Date().toISOString(),
          }

          const transactions = [transaction, ...state.cementTransactions].slice(
            0,
            MAX_TRANSACTIONS,
          )

          return {
            cementItems: {
              ...state.cementItems,
              [input.product]: {
                ...currentItem,
                quantity: nextQuantity,
                averageCostPrice: nextAverageCostPrice,
              },
            },
            cementTransactions: transactions,
          }
        })
      },
      deductCementStock: (input) => {
        const quantity = toNonNegativeNumber(input.quantity)
        if (quantity === 0) return

        const currentItem = get().cementItems[input.product]
        if (quantity > currentItem.quantity) {
          throw new Error('Cannot deduct more stock than available.')
        }

        const unitSellingPrice = roundMoney(input.unitSellingPrice ?? currentItem.sellingPrice)
        const unitCostPrice = currentItem.averageCostPrice
        const profit = computeSaleProfit({
          quantity,
          unitSellingPrice,
          unitCostPrice,
        })

        set((state) => {
          const transaction: CementTransaction = {
            id: createId(),
            type: 'SALE',
            product: input.product,
            quantity,
            unitCost: unitCostPrice,
            unitPrice: unitSellingPrice,
            profit,
            createdAt: new Date().toISOString(),
          }

          const transactions = [transaction, ...state.cementTransactions].slice(
            0,
            MAX_TRANSACTIONS,
          )

          return {
            cementItems: {
              ...state.cementItems,
              [input.product]: {
                ...state.cementItems[input.product],
                quantity: state.cementItems[input.product].quantity - quantity,
                sellingPrice: unitSellingPrice,
              },
            },
            cementTransactions: transactions,
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
      setCementAverageCostPrice: (product, averageCostPrice) => {
        const value = roundMoney(averageCostPrice)
        set((state) => ({
          cementItems: {
            ...state.cementItems,
            [product]: { ...state.cementItems[product], averageCostPrice: value },
          },
        }))
      },
      setCementSellingPrice: (product, unitSellingPrice) => {
        const value = roundMoney(unitSellingPrice)
        set((state) => ({
          cementItems: {
            ...state.cementItems,
            [product]: { ...state.cementItems[product], sellingPrice: value },
          },
        }))
      },
      setCementLowStockThreshold: (product, lowStockThreshold) => {
        const value = Math.round(toNonNegativeNumber(lowStockThreshold))
        set((state) => ({
          cementItems: {
            ...state.cementItems,
            [product]: { ...state.cementItems[product], lowStockThreshold: value },
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

        const cementItems = data.cementItems ?? defaultCementItems
        const nextCementItems: CementItems = {
          PPC: { ...defaultCementItems.PPC, ...(cementItems.PPC ?? {}) },
          OPC: { ...defaultCementItems.OPC, ...(cementItems.OPC ?? {}) },
        }
        const nextCementTransactions = (
          Array.isArray(data.cementTransactions) ? data.cementTransactions : []
        ).slice(0, MAX_TRANSACTIONS)

        set({
          items: nextItems,
          transactions: nextTransactions,
          cementItems: nextCementItems,
          cementTransactions: nextCementTransactions,
        })
      },
      reset: () => {
        set({
          items: defaultItems,
          transactions: [],
          cementItems: defaultCementItems,
          cementTransactions: [],
        })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        items: state.items,
        transactions: state.transactions,
        cementItems: state.cementItems,
        cementTransactions: state.cementTransactions,
      }),
    },
  ),
)

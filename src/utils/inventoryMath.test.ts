import { describe, expect, it } from 'vitest'
import { computeSaleProfit, computeWeightedAverageCostPrice } from './inventoryMath'

describe('computeWeightedAverageCostPrice', () => {
  it('computes weighted average cost price', () => {
    const avg = computeWeightedAverageCostPrice({
      currentQuantity: 10,
      currentAverageCostPrice: 100,
      addedQuantity: 10,
      addedUnitCostPrice: 200,
    })

    expect(avg).toBe(150)
  })

  it('handles empty current stock', () => {
    const avg = computeWeightedAverageCostPrice({
      currentQuantity: 0,
      currentAverageCostPrice: 0,
      addedQuantity: 20,
      addedUnitCostPrice: 325.5,
    })

    expect(avg).toBe(325.5)
  })
})

describe('computeSaleProfit', () => {
  it('computes profit for a sale', () => {
    expect(
      computeSaleProfit({
        quantity: 5,
        unitSellingPrice: 150,
        unitCostPrice: 100,
      }),
    ).toBe(250)
  })

  it('rounds to 2 decimal places', () => {
    expect(
      computeSaleProfit({
        quantity: 3,
        unitSellingPrice: 10.333,
        unitCostPrice: 9.111,
      }),
    ).toBe(3.67)
  })
})


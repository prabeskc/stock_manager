import { roundMoney, toNonNegativeNumber } from './number'

export function computeWeightedAverageCostPrice(params: {
  currentQuantity: number
  currentAverageCostPrice: number
  addedQuantity: number
  addedUnitCostPrice: number
}): number {
  const currentQuantity = toNonNegativeNumber(params.currentQuantity)
  const currentAverageCostPrice = toNonNegativeNumber(params.currentAverageCostPrice)
  const addedQuantity = toNonNegativeNumber(params.addedQuantity)
  const addedUnitCostPrice = toNonNegativeNumber(params.addedUnitCostPrice)

  const newQuantity = currentQuantity + addedQuantity
  if (newQuantity === 0) return 0

  const totalCost =
    currentQuantity * currentAverageCostPrice + addedQuantity * addedUnitCostPrice

  return roundMoney(totalCost / newQuantity)
}

export function computeSaleProfit(params: {
  quantity: number
  unitSellingPrice: number
  unitCostPrice: number
}): number {
  const quantity = toNonNegativeNumber(params.quantity)
  const unitSellingPrice = toNonNegativeNumber(params.unitSellingPrice)
  const unitCostPrice = toNonNegativeNumber(params.unitCostPrice)

  return roundMoney((unitSellingPrice - unitCostPrice) * quantity)
}

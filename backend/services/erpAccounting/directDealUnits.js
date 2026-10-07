const GRAMS_PER_TROY_OUNCE = 31.1034768

const DIRECT_DEAL_STOCK_TO_OZ = {
  OZ: 1,
  GRAM: 1 / GRAMS_PER_TROY_OUNCE,
  KG: 1000 / GRAMS_PER_TROY_OUNCE,
}

const normalizeDirectDealStockCode = (value) => String(value || 'OZ').trim().toUpperCase()

const directDealEqOzFromQtyAndStock = (qty, stockCode) => {
  const ratio = DIRECT_DEAL_STOCK_TO_OZ[normalizeDirectDealStockCode(stockCode)] || 1
  return Number(qty || 0) * ratio
}

module.exports = {
  normalizeDirectDealStockCode,
  directDealEqOzFromQtyAndStock,
}

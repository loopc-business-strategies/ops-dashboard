const DIRECT_DEAL_STOCK_TO_OZ = {
  OZ: 1,
  GRAM: 0.0321507,
  KG: 32.1507,
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

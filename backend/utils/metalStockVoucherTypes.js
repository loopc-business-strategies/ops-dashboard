const METAL_STOCK_IN_TYPES = ['purchase', 'metal_receipt']
const METAL_STOCK_OUT_TYPES = ['sale', 'metal_payment']
const METAL_STOCK_TYPES = [...METAL_STOCK_IN_TYPES, ...METAL_STOCK_OUT_TYPES]

const isMetalStockInType = (type) => METAL_STOCK_IN_TYPES.includes(String(type || '').toLowerCase())
const isMetalStockOutType = (type) => METAL_STOCK_OUT_TYPES.includes(String(type || '').toLowerCase())
const isMetalStockType = (type) => METAL_STOCK_TYPES.includes(String(type || '').toLowerCase())

/** Maps metal receipt/payment to purchase/sale for stock movement reason labels. */
const stockMovementReferenceType = (type) => (
  isMetalStockInType(type) ? 'purchase' : 'sale'
)

module.exports = {
  METAL_STOCK_IN_TYPES,
  METAL_STOCK_OUT_TYPES,
  METAL_STOCK_TYPES,
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  stockMovementReferenceType,
}

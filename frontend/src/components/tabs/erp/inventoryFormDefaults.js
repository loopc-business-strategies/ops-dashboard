import {
  buildAutoStockCode,
  buildUniqueStockCode,
  decodeInventoryCategoryMeta,
  encodeInventoryCategoryMeta,
  resolveMainStockValueFromForm,
  titleCaseWords,
} from './erpTabUtils'

export function mappingProductToFormState(product, baseCurrencyCode = 'USD') {
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  const meta = decodeInventoryCategoryMeta(product.category)
  const resolvedMainStock = meta.mainStock || meta.metalType || ''
  const priceValue = Number(product.unitCost || product.sellingPrice || 0)
  return {
    mainStock: resolvedMainStock || 'gold',
    customMainStock: '',
    metalType: meta.metalType || resolvedMainStock || 'gold',
    stockCode: product.sku || '',
    unit: 'grams',
    currency: product.currency || base,
    currentPrice: priceValue > 0 ? String(priceValue) : '',
    priceUnit: meta.priceUnit || 'OZ',
    priceCurrency: meta.priceCurrency || product.currency || base,
    openingQty: '',
  }
}

export function buildInventoryMappingPayload({
  form,
  includeOpeningQty = true,
  inventoryStockCodeSettings,
  inventoryMappingProducts,
  editingProductId,
  isSuperAdmin,
  baseCurrencyCode = 'USD',
}) {
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  const mainStockValue = resolveMainStockValueFromForm(form)
  const normalizedMetalType = String(form.metalType || '').trim().toLowerCase()
  const priceCurrency = form.priceCurrency || base
  const categoryMeta = encodeInventoryCategoryMeta({
    mainStock: mainStockValue,
    metalType: normalizedMetalType,
    priceUnit: form.priceUnit || 'OZ',
    priceCurrency,
  })
  const label = titleCaseWords(mainStockValue || normalizedMetalType || 'Main Stock')
  const autoSku = buildUniqueStockCode(
    buildAutoStockCode(form, inventoryStockCodeSettings),
    inventoryMappingProducts,
    editingProductId,
  )
  const resolvedSku = isSuperAdmin
    ? (String(form.stockCode || '').trim().toUpperCase() || autoSku)
    : autoSku
  const priceValue = parseFloat(form.currentPrice) || 0
  const payload = {
    sku: resolvedSku,
    name: `${label} Main Stock`,
    category: categoryMeta,
    unit: 'grams',
    unitCost: priceValue,
    sellingPrice: priceValue,
    currency: priceCurrency,
    description: priceValue > 0 ? `${priceValue} ${priceCurrency}/${form.priceUnit || 'OZ'}` : undefined,
  }
  if (includeOpeningQty) {
    payload.quantity = Number(form.openingQty || 0)
  }
  return payload
}

export function computeInventoryProductPurityWeight(productForm) {
  const purityFactorRaw = Number(productForm.purity || 0)
  const purityFactor = purityFactorRaw > 1 ? purityFactorRaw / 1000 : purityFactorRaw
  return (Number(productForm.weight || 0) || 0) * (Number.isFinite(purityFactor) ? purityFactor : 0)
}

/** Normalize stored purity (ratio or millesimal) to a 0–1 factor; invalid/blank → 0. */
export function resolveInventoryPurityFactor(purity) {
  const purityNumeric = Number(purity || 0)
  if (!Number.isFinite(purityNumeric) || purityNumeric <= 0) return 0
  return purityNumeric > 1.2 ? purityNumeric / 1000 : purityNumeric
}

/** Pure on-hand qty from gross qty × purity; missing/zero purity → 0 (do not treat as 1). */
export function computeInventoryPureStockQty(quantity, purity) {
  const qty = Math.max(0, Number(quantity || 0))
  const factor = resolveInventoryPurityFactor(purity)
  if (!(factor > 0)) return 0
  return qty * factor
}

/** Inventory value: use pure qty when purity is set, otherwise gross qty. */
export function computeInventoryStockValue(quantity, unitCost, purity) {
  const cost = Number(unitCost || 0)
  const factor = resolveInventoryPurityFactor(purity)
  const qtyForValue = factor > 0
    ? computeInventoryPureStockQty(quantity, purity)
    : Math.max(0, Number(quantity || 0))
  return qtyForValue * (Number.isFinite(cost) ? cost : 0)
}

/**
 * Resolve metal voucher line purity from catalog product, else karat in the name (22k → 0.917).
 * Never falls back to a prior stock fine-purity value.
 */
export function resolveProductLinePurity({ productPurity, productName } = {}) {
  const catalogRaw = String(productPurity ?? '').trim()
  const catalogNumeric = Number(catalogRaw)
  if (catalogRaw !== '' && Number.isFinite(catalogNumeric) && catalogNumeric > 0) {
    return String(catalogRaw)
  }

  const karatMatch = String(productName || '').match(/\b(\d{1,2})\s*k\b/i)
  if (karatMatch) {
    const karat = Number(karatMatch[1])
    if (Number.isFinite(karat) && karat > 0 && karat <= 24) {
      return (karat / 24).toFixed(3)
    }
  }

  return ''
}

export function sanitizeInventoryMetaText(value) {
  return String(value || '').replace(/[;\n\r]/g, ' ').trim()
}

export function resolveCatalogProductEditForm({ productItem, productMeta, inventoryMappingProducts }) {
  let matchedStockType = inventoryMappingProducts.find((stockTypeItem) => (
    String(productItem.category || '').startsWith(`${String(stockTypeItem.category || '')};recordType=product`)
  ))
  if (!matchedStockType && productMeta?.mainStock) {
    const mainStockLower = String(productMeta.mainStock).toLowerCase().trim()
    matchedStockType = inventoryMappingProducts.find((stockTypeItem) => {
      const stockName = String(stockTypeItem.name || '').toLowerCase().trim()
      const stockMeta = decodeInventoryCategoryMeta(stockTypeItem.category)
      const stockMainLower = String(stockMeta.mainStock || stockMeta.metalType || '').toLowerCase().trim()
      return stockName === mainStockLower || stockMainLower === mainStockLower
    })
  }
  return {
    stockTypeId: matchedStockType?._id || '',
    categoryName: productMeta?.productCategory || titleCaseWords(productMeta?.mainStock || productMeta?.metalType || matchedStockType?.name || ''),
    name: productItem.name || '',
    description: productMeta?.productDescription || '',
    weight: String(productMeta?.weight ?? productItem.quantity ?? ''),
    grossWeight: String(productMeta?.grossWeight ?? productMeta?.weight ?? productItem.quantity ?? ''),
    purity: productMeta?.productPurity || productMeta?.purity || '',
    taxType: productMeta?.taxType || 'VAT',
    vatPercent: String(productMeta?.vatPercent ?? ''),
  }
}

export function buildCatalogProductPayload({
  inventoryProductForm,
  inventoryMappingProducts,
  inventoryCatalogProducts,
  editingInventoryProductId,
  selectedInventoryStockType,
  productPurityWeight,
  baseCurrencyCode = 'USD',
}) {
  const base = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  const selectedStockType = inventoryMappingProducts.find((item) => item._id === inventoryProductForm.stockTypeId)
  let baseCategory = ''
  if (selectedStockType) {
    baseCategory = String(selectedStockType.category || '').replace(/;?recordType=product/gi, '')
  } else if (editingInventoryProductId) {
    const existingProduct = inventoryCatalogProducts.find((p) => p._id === editingInventoryProductId)
    if (existingProduct) {
      baseCategory = String(existingProduct.category || '').replace(/;recordType=product.*$/gi, '')
    }
  }
  const categoryName = sanitizeInventoryMetaText(inventoryProductForm.categoryName || selectedInventoryStockType?.mainStock || '')
  const productDescription = sanitizeInventoryMetaText(inventoryProductForm.description)
  const productWeight = Number(inventoryProductForm.weight || 0)
  const productGrossWeight = Number(inventoryProductForm.grossWeight || inventoryProductForm.weight || 0)
  const productPurity = String(inventoryProductForm.purity || '').trim()
  const productTaxType = sanitizeInventoryMetaText(inventoryProductForm.taxType || 'VAT')
  const vatPercentRaw = Number(inventoryProductForm.vatPercent || 0)
  const productVatPercent = Number.isFinite(vatPercentRaw) && vatPercentRaw >= 0
    ? Number(vatPercentRaw.toFixed(2))
    : 0
  const purityWeight = Number(productPurityWeight || 0)
  const existingCurrency = editingInventoryProductId
    ? inventoryCatalogProducts.find((p) => p._id === editingInventoryProductId)?.currency
    : null
  return {
    name: inventoryProductForm.name.trim(),
    category: `${baseCategory};recordType=product;productCategory=${categoryName};productDescription=${productDescription};weight=${productWeight};grossWeight=${productGrossWeight};productPurity=${productPurity};taxType=${productTaxType};vatPercent=${productVatPercent};purityWeight=${purityWeight}`,
    unit: 'grams',
    quantity: productWeight,
    unitCost: 0,
    sellingPrice: 0,
    currency: existingCurrency || selectedStockType?.currency || base,
  }
}

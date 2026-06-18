import { useMemo } from 'react'
import {
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  titleCaseWords,
} from './erpTabUtils'

const normalizeToMetalCode = (rawValue) => {
  const normalized = String(rawValue || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized === 'xau' || normalized === 'gold') return 'XAU'
  if (normalized === 'xag' || normalized === 'silver') return 'XAG'
  if (normalized === 'xpt' || normalized === 'platinum') return 'XPT'
  if (normalized === 'xpd' || normalized === 'palladium') return null
  return String(rawValue || '').trim().toUpperCase()
}

/** Stock-type dropdown options for the fixing register metal filter. */
export function useFixingRegisterStockTypeOptions({
  inventoryMappingProducts,
  inventoryCatalogProducts,
}) {
  return useMemo(() => {
    const stockTypeOptions = inventoryMappingProducts.map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const labelName = titleCaseWords(meta.mainStock || meta.metalType || item.name || item.sku || 'Stock Type')
      const puritySuffix = meta.purity ? ` (${meta.purity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${labelName}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (stockTypeOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...stockTypeOptions,
      ]
    }
    const legacyProductOptions = inventoryCatalogProducts.map((item) => {
      const meta = decodeInventoryCategoryPairs(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const productLabel = titleCaseWords(meta.productCategory || item.name || item.sku || 'Product')
      const puritySuffix = meta.productPurity ? ` (${meta.productPurity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${productLabel}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (legacyProductOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...legacyProductOptions,
      ]
    }
    return [
      { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
      { id: 'metal-gold', value: 'XAU::fallback-gold', metalCode: 'XAU', label: 'Gold (XAU)' },
      { id: 'metal-silver', value: 'XAG::fallback-silver', metalCode: 'XAG', label: 'Silver (XAG)' },
      { id: 'metal-platinum', value: 'XPT::fallback-platinum', metalCode: 'XPT', label: 'Platinum (XPT)' },
      { id: 'metal-other', value: 'OTHER::fallback-other', metalCode: 'OTHER', label: 'Other Metals' },
    ]
  }, [inventoryCatalogProducts, inventoryMappingProducts])
}

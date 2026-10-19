import { computeInventoryPureStockQty } from '../tabs/erp/inventoryFormDefaults'
import { decodeInventoryCategoryMeta, decodeInventoryCategoryPairs, titleCaseWords } from '../tabs/erp/erpTabUtils'

/** Same product set as All Inventory Items: products and legacy rows, not stock-type masters. */
export function isInventoryReportProduct(category) {
  const raw = String(category || '')
  if (raw.includes('recordType=product')) return true
  return !raw.includes('mainStock=')
}

/** Category label matching the Inventory table cell: main stock, else the plain category. */
export function inventoryCategoryLabel(category) {
  const raw = String(category || '').trim()
  const mainStock = decodeInventoryCategoryMeta(raw).mainStock
  if (mainStock) return titleCaseWords(mainStock)
  if (!raw || raw.includes('=')) return 'Other'
  return titleCaseWords(raw)
}

export function buildVaultStockGroups(products) {
  const groups = []
  const byCategory = new Map()
  ;(products || []).forEach((item) => {
    if (!item || !isInventoryReportProduct(item.category)) return
    const category = inventoryCategoryLabel(item.category)
    const pairs = decodeInventoryCategoryPairs(item.category)
    const meta = decodeInventoryCategoryMeta(item.category)
    const grossQty = Math.max(0, Number(item.quantity || 0))
    const purity = pairs.productPurity || pairs.purity || meta.purity || ''
    const row = {
      id: item._id || item.id || `${category}-${item.name}`,
      name: item.name || '—',
      category,
      grossQty,
      pureQty: computeInventoryPureStockQty(grossQty, purity),
      unit: item.unit || 'pcs',
    }
    if (!byCategory.has(category)) {
      const group = { category, items: [] }
      byCategory.set(category, group)
      groups.push(group)
    }
    byCategory.get(category).items.push(row)
  })
  return groups
}

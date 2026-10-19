import { computeInventoryPureStockQty } from './inventoryFormDefaults'
import { decodeInventoryCategoryMeta, decodeInventoryCategoryPairs, titleCaseWords } from './erpTabUtils'

/** Same category the inventory table shows: decoded main stock, otherwise the stored category. */
export function inventoryCategoryLabel(category, categoryMeta) {
  const meta = categoryMeta || decodeInventoryCategoryMeta(category)
  const raw = String(meta.mainStock || category || '').trim()
  const source = raw.includes('=') ? String(meta.mainStock || '').trim() : raw
  return titleCaseWords(source) || 'Other'
}

/** Catalog products and older items. Stock-type masters are not inventory lines. */
export function isInventoryReportProduct(item) {
  const category = String(item?.category || '')
  if (category.includes('recordType=product')) return true
  return !category.includes('mainStock=')
}

export function groupInventoryTableRows(rows) {
  const groups = []
  const indexByLabel = new Map()
  ;(rows || []).forEach((row) => {
    const label = inventoryCategoryLabel(row?.item?.category, row?.categoryMeta)
    let index = indexByLabel.get(label)
    if (index == null) {
      index = groups.length
      indexByLabel.set(label, index)
      groups.push({ category: label, rows: [] })
    }
    groups[index].rows.push(row)
  })
  return groups
}

export function buildVaultStockGroups(products) {
  const lines = (products || []).filter(isInventoryReportProduct).map((item) => {
    const categoryMeta = decodeInventoryCategoryMeta(item?.category)
    const grossQty = Math.max(0, Number(item?.quantity || 0))
    const pairs = decodeInventoryCategoryPairs(item?.category)
    const purity = pairs.productPurity || pairs.purity || categoryMeta.purity || ''
    return {
      id: String(item?._id || item?.id || item?.sku || item?.name || ''),
      name: item?.name || '—',
      category: inventoryCategoryLabel(item?.category, categoryMeta),
      grossQty,
      pureQty: computeInventoryPureStockQty(grossQty, purity),
      unit: item?.unit || 'grams',
    }
  })
  const groups = []
  const indexByLabel = new Map()
  lines.forEach((line) => {
    let index = indexByLabel.get(line.category)
    if (index == null) {
      index = groups.length
      indexByLabel.set(line.category, index)
      groups.push({ category: line.category, items: [] })
    }
    groups[index].items.push(line)
  })
  return groups
}

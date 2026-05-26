const InventoryItem = require('../models/InventoryItem')

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const categoryPurityFromString = (category) => {
  const m = String(category || '').match(/(?:^|;)purity=([\d.]+)/i)
  return m ? Number(m[1]) : 0
}

const metalCategoryClauseForStockCode = (stockCode) => {
  const c = String(stockCode || '').trim().toUpperCase()
  if (!c) return null
  if (c === 'GOLD' || c === 'XAU') {
    return { $or: [{ category: /mainStock=gold/i }, { category: /metalType=gold/i }, { category: /metalType=xau/i }] }
  }
  if (c === 'SILVER' || c === 'XAG') {
    return { $or: [{ category: /mainStock=silver/i }, { category: /metalType=silver/i }, { category: /metalType=xag/i }] }
  }
  if (c === 'PLATINUM' || c === 'XPT') {
    return { $or: [{ category: /mainStock=platinum/i }, { category: /metalType=platinum/i }, { category: /metalType=xpt/i }] }
  }
  if (c === 'PALLADIUM' || c === 'XPD') {
    return { $or: [{ category: /mainStock=palladium/i }, { category: /metalType=palladium/i }, { category: /metalType=xpd/i }] }
  }
  return null
}

/** Infer metal stock category from product description when stockCode is a label (e.g. "Gold Main Stock"). */
const metalCategoryClauseFromProductType = (productType) => {
  const u = String(productType || '').trim().toUpperCase()
  if (!u) return null
  if (/\bXAU\b/.test(u) || /\bGOLD\b/.test(u)) return metalCategoryClauseForStockCode('GOLD')
  if (/\bXAG\b/.test(u) || /\bSILVER\b/.test(u)) return metalCategoryClauseForStockCode('SILVER')
  if (/\bXPT\b/.test(u) || /\bPLATINUM\b/.test(u)) return metalCategoryClauseForStockCode('PLATINUM')
  if (/\bXPD\b/.test(u) || /\bPALLADIUM\b/.test(u)) return metalCategoryClauseForStockCode('PALLADIUM')
  return null
}

const pushLineLookupConditions = (orList, rawValue) => {
  const v = String(rawValue || '').trim()
  if (!v) return
  orList.push({ sku: v })
  orList.push({ sku: new RegExp(`^${escapeRegex(v)}$`, 'i') })
  orList.push({ name: new RegExp(`^${escapeRegex(v)}$`, 'i') })
  if (v.length >= 2) {
    orList.push({ name: new RegExp(escapeRegex(v), 'i') })
    orList.push({ sku: new RegExp(escapeRegex(v), 'i') })
  }
}

/**
 * Load candidate inventory rows for a voucher line (SKU, name, metal hints, explicit item id).
 */
const collectVoucherLineInventoryCandidates = async (line) => {
  const stockCode = String(line?.stockCode || '').trim()
  const productType = String(line?.productType || '').trim()
  const metalHint = String(line?.metalSymbol || line?.metalName || '').trim()

  const directId = line?.inventoryItemId || line?.itemId
  if (directId && /^[a-f\d]{24}$/i.test(String(directId))) {
    const one = await InventoryItem.findOne({ _id: directId, isDeleted: { $ne: true } })
    return one ? [one] : []
  }

  if (!stockCode && !productType) return []

  const orConditions = []
  if (stockCode) pushLineLookupConditions(orConditions, stockCode)
  if (productType) pushLineLookupConditions(orConditions, productType)

  const productBase = { isDeleted: { $ne: true }, category: /recordType=product/i }
  const anyBase = { isDeleted: { $ne: true } }

  let candidates = await InventoryItem.find({ ...productBase, $or: orConditions }).limit(40)
  if (candidates.length) return candidates

  const metalClause =
    metalCategoryClauseForStockCode(stockCode)
    || metalCategoryClauseForStockCode(metalHint)
    || metalCategoryClauseFromProductType(productType)
    || metalCategoryClauseFromProductType(stockCode)

  if (metalClause) {
    candidates = await InventoryItem.find({ ...productBase, ...metalClause }).limit(40)
    if (candidates.length) return candidates
  }

  candidates = await InventoryItem.find({ ...anyBase, $or: orConditions }).limit(40)
  if (candidates.length) return candidates

  if (metalClause) {
    candidates = await InventoryItem.find({ ...anyBase, ...metalClause }).limit(40)
    if (candidates.length) return candidates
  }

  const token = [...String(productType || '').split(/\s+/), ...String(stockCode || '').split(/\s+/)]
    .map((s) => s.trim())
    .find((t) => t.length >= 3)
  if (token) {
    const re = new RegExp(escapeRegex(token), 'i')
    candidates = await InventoryItem.find({ ...productBase, $or: [{ name: re }, { sku: re }] }).limit(40)
    if (candidates.length) return candidates
    candidates = await InventoryItem.find({ ...anyBase, $or: [{ name: re }, { sku: re }] }).limit(40)
  }

  return candidates || []
}

const scoreInventoryLineMatch = (item, line) => {
  const stockCode = String(line?.stockCode || '').trim().toLowerCase()
  const productType = String(line?.productType || '').trim().toLowerCase()
  const cat = String(item.category || '')
  const isProduct = /recordType=product/i.test(cat)
  const iname = String(item.name || '').trim().toLowerCase()
  const isku = String(item.sku || '').trim().toLowerCase()

  let score = 0
  if (isProduct) score += 200

  if (productType) {
    if (iname === productType) score += 95
    else if (iname.includes(productType)) score += 68
    else if (productType.length >= 4 && iname.length >= 3 && productType.includes(iname)) score += 42
    if (isku === productType) score += 88
    else if (isku && productType && (isku.includes(productType) || productType.includes(isku))) score += 50
  }

  if (stockCode) {
    if (isku === stockCode) score += 82
    else if (isku && (isku.includes(stockCode) || stockCode.includes(isku))) score += 52
    if (iname === stockCode) score += 78
  }

  const linePurity = Number(line.purity || 0)
  const pr = linePurity > 1.2 ? linePurity / 1000 : linePurity
  const itemPurRaw = categoryPurityFromString(cat)
  const ir = itemPurRaw > 1.2 ? itemPurRaw / 1000 : itemPurRaw
  if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 1e-6) score += 70
  else if (pr > 0 && ir > 0 && Math.abs(ir - pr) < 0.02) score += 40
  const lineGross = Number(line.grossWeight || 0)
  const mGw = cat.match(/(?:^|;)grossWeight=([\d.]+)/i) || cat.match(/(?:^|;)weight=([\d.]+)/i)
  const itemGross = mGw ? Number(mGw[1]) : Number(item.weight || 0)
  if (lineGross > 0 && itemGross > 0 && Math.abs(lineGross - itemGross) < 0.001) score += 25
  return score
}

module.exports = {
  collectVoucherLineInventoryCandidates,
  scoreInventoryLineMatch,
}

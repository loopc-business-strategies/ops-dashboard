/** Karat → gold / alloy ratio percentages (sum 100). */
export const GOLD_ALLOY_KARAT_RECIPES = [
  { karat: 24, goldRatio: 100, alloyRatio: 0, label: '24K' },
  { karat: 22, goldRatio: 91.6, alloyRatio: 8.4, label: '22K' },
  { karat: 21, goldRatio: 87.5, alloyRatio: 12.5, label: '21K' },
  { karat: 18, goldRatio: 75, alloyRatio: 25, label: '18K' },
  { karat: 14, goldRatio: 58.333, alloyRatio: 41.667, label: '14K' },
]

export const GOLD_ALLOY_LINE_TEMPLATES = [
  { key: 'gold', label: 'gold', role: 'gold' },
  { key: 'silver', label: 'silver', role: 'alloy' },
  { key: 'copper', label: 'copper', role: 'extra' },
  { key: 'cadmium', label: 'cadmium', role: 'extra' },
  { key: 'platinum', label: 'platinum', role: 'extra' },
]

const GROSS_EPS = 0.0005

export function roundAlloyGrams(value, digits = 3) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = 10 ** digits
  return Math.round(n * f) / f
}

/** Normalize purity: 916 → 0.916, 91.6 → 0.916, 0.916 stays. */
export function normalizeAlloyPurity(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n > 1.2 && n <= 100) return n / 100
  if (n > 100) return n / 1000
  return n
}

export function resolveKaratRecipe(karat) {
  const k = Number(karat)
  return GOLD_ALLOY_KARAT_RECIPES.find((row) => row.karat === k) || null
}

export function computeAlloyComponentGross(targetGross, ratioPercent) {
  const target = Number(targetGross)
  const ratio = Number(ratioPercent)
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(ratio)) return 0
  return roundAlloyGrams((target * ratio) / 100)
}

/**
 * Spreadsheet-style calculated mix gross from fine-gold input weight.
 * e.g. gold 200 g @ 18K (75%) → 200 / 0.75 = 266.6667 g finished.
 * goldRatioPercent is 75 for 18K (not 0.75).
 */
export function computeCalculatedGrossFromGoldWeight(goldGross, goldRatioPercent) {
  const g = Number(goldGross)
  const ratio = Number(goldRatioPercent)
  if (!(g > 0) || !(ratio > 0)) return ''
  return String(roundAlloyGrams(g / (ratio / 100), 4))
}

export function computeAlloyPure(gross, purity) {
  const g = Number(gross)
  const p = normalizeAlloyPurity(purity)
  if (!Number.isFinite(g) || g <= 0 || p <= 0) return 0
  return roundAlloyGrams(g * p)
}

function buildAlloyLineFromTemplate(row) {
  return {
    key: row.key,
    label: row.label,
    role: row.role,
    stockId: '',
    stockLabel: '',
    gross: '',
    purity: row.role === 'extra' ? '' : '1',
    pure: 0,
  }
}

/** Full template set (includes hidden extras). Prefer createBlankAlloyMixLines for new mixes. */
export function createEmptyAlloyLines() {
  return GOLD_ALLOY_LINE_TEMPLATES.map(buildAlloyLineFromTemplate)
}

/** New mix starts with no rows — user adds them one-by-one with + Add. */
export function createBlankAlloyMixLines() {
  return []
}

/**
 * Metal row types not yet on the mix (user picks one when clicking + Add).
 * When stockOptions is provided, only metals that have a matching catalog product
 * (not stock types / finished alloy) are offered — e.g. hide cadmium/platinum until created.
 */
export function listAvailableAlloyLineTemplates(lines = [], { stockOptions } = {}) {
  const used = new Set((Array.isArray(lines) ? lines : []).map((line) => String(line.key)))
  const unused = GOLD_ALLOY_LINE_TEMPLATES.filter((row) => !used.has(row.key))
  if (stockOptions === undefined) return unused
  return unused.filter((row) => buildAlloyInputStockOptionsForLine(stockOptions, row.key).length > 0)
}

/** Append a chosen metal row by template key (e.g. gold, silver, copper). */
export function addAlloyLineByKey(lines = [], key) {
  const list = Array.isArray(lines) ? [...lines] : []
  const templateKey = String(key || '').trim()
  if (!templateKey) return list
  if (list.some((line) => line.key === templateKey)) return list
  const template = GOLD_ALLOY_LINE_TEMPLATES.find((row) => row.key === templateKey)
  if (!template) return list
  list.push(buildAlloyLineFromTemplate(template))
  return list
}

/** @deprecated Prefer addAlloyLineByKey after user selects a metal. */
export function addNextAlloyExtraLine(lines = []) {
  const next = listAvailableAlloyLineTemplates(lines)[0]
  return next ? addAlloyLineByKey(lines, next.key) : (Array.isArray(lines) ? [...lines] : [])
}

/** Remove any mix row (including gold / silver) so user can rebuild from empty. */
export function removeAlloyExtraLine(lines = [], key) {
  const list = Array.isArray(lines) ? lines : []
  return list.filter((line) => line.key !== key)
}

/**
 * Split alloy gross across primary alloy (silver) + any extra metal rows
 * already on the mix (copper, cadmium, platinum). Equal shares; last row
 * absorbs rounding so the mix still balances.
 */
function allocateAlloyGrossShares(alloyGross, shareCount) {
  const n = Number(shareCount) || 0
  const total = Number(alloyGross) || 0
  if (n <= 0 || !(total > 0)) return []
  if (n === 1) return [roundAlloyGrams(total)]
  const each = roundAlloyGrams(total / n)
  const shares = Array.from({ length: n }, () => each)
  const allocated = roundAlloyGrams(each * (n - 1))
  shares[n - 1] = roundAlloyGrams(total - allocated)
  return shares
}

/** Apply karat ratios + target gross onto gold and alloy-metal lines. */
export function applyAlloyRecipeToLines(lines, {
  targetGross,
  goldRatio,
  alloyRatio,
} = {}) {
  const list = Array.isArray(lines) ? lines : createEmptyAlloyLines()
  const goldGross = computeAlloyComponentGross(targetGross, goldRatio)
  const alloyGross = computeAlloyComponentGross(targetGross, alloyRatio)
  const alloyMetalIndexes = list
    .map((line, index) => ((line.role === 'alloy' || line.role === 'extra') ? index : -1))
    .filter((index) => index >= 0)
  const shares = allocateAlloyGrossShares(alloyGross, alloyMetalIndexes.length)
  const shareByIndex = new Map(alloyMetalIndexes.map((index, i) => [index, shares[i]]))

  return list.map((line, index) => {
    if (line.role === 'gold') {
      const gross = goldGross > 0 ? goldGross : ''
      const purity = line.purity === '' || line.purity == null ? '1' : line.purity
      return {
        ...line,
        gross,
        purity,
        pure: computeAlloyPure(gross, purity),
      }
    }
    if (shareByIndex.has(index)) {
      const share = shareByIndex.get(index)
      const gross = share > 0 ? share : ''
      const purity = line.purity === '' || line.purity == null ? '1' : line.purity
      return {
        ...line,
        gross,
        purity,
        pure: computeAlloyPure(gross, purity),
      }
    }
    return {
      ...line,
      pure: computeAlloyPure(line.gross, line.purity),
    }
  })
}

export function summarizeAlloyLines(lines = [], targetGross = 0) {
  const list = Array.isArray(lines) ? lines : []
  const totalGross = roundAlloyGrams(list.reduce((sum, line) => sum + Number(line.gross || 0), 0))
  const totalPure = roundAlloyGrams(list.reduce((sum, line) => sum + Number(line.pure || 0), 0))
  const target = Number(targetGross) || 0
  const diff = roundAlloyGrams(totalGross - target)
  const percent = target > 0 ? roundAlloyGrams((totalGross / target) * 100, 2) : 0
  const balanced = target > 0 && Math.abs(diff) <= GROSS_EPS
  return {
    totalGross,
    totalPure,
    target,
    diff,
    percent,
    balanced,
    checkLabel: !target
      ? 'Enter target gross weight'
      : balanced
        ? '100%'
        : `${percent}% (${diff > 0 ? '+' : ''}${diff} g)`,
  }
}

function formatAlloyStockLabel({ name, mainStock, purity, quantity, includeQty = false } = {}) {
  const qty = Number(quantity || 0)
  const qtyPart = includeQty
    ? ` · ${qty.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
    : ''
  return `${name || ''}${mainStock ? ` (${mainStock})` : ''}${purity ? ` · p ${purity}` : ''}${qtyPart}`
}

export function buildAlloyStockOptions(inventoryProducts = []) {
  const list = Array.isArray(inventoryProducts) ? inventoryProducts : []
  return list
    .map((item) => {
      const id = String(item?._id || '')
      if (!id) return null
      const category = String(item?.category || '')
      const pairs = Object.fromEntries(
        category.split(';').map((part) => {
          const i = part.indexOf('=')
          if (i < 0) return [part.trim(), '']
          return [part.slice(0, i).trim(), part.slice(i + 1).trim()]
        }).filter(([k]) => k),
      )
      const mainStock = pairs.mainStock || pairs.metalType || ''
      const isProduct = pairs.recordType === 'product'
      const purity = pairs.productPurity || pairs.purity || ''
      const name = String(item?.name || '').trim() || id
      const kind = isProduct ? 'product' : 'stock-type'
      const quantity = Number(item?.quantity || 0)
      return {
        id,
        name,
        label: formatAlloyStockLabel({ name, mainStock, purity, quantity, includeQty: false }),
        inputLabel: formatAlloyStockLabel({ name, mainStock, purity, quantity, includeQty: true }),
        mainStock,
        purity,
        kind,
        quantity,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'product' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/** Catalog products only for mix input Select inventory (excludes stock types + finished alloy). */
export function buildAlloyInputStockOptions(stockOptions = [], { excludeIds = [] } = {}) {
  const excluded = new Set((Array.isArray(excludeIds) ? excludeIds : []).map(String).filter(Boolean))
  return (Array.isArray(stockOptions) ? stockOptions : []).filter((row) => (
    row.kind === 'product'
    && !excluded.has(String(row.id))
    && !/alloy|alloyed/i.test(`${row.name} ${row.mainStock}`)
  ))
}

/** True when catalog product matches the mix line metal (gold → gold only, etc.). */
export function matchesAlloyLineMetal(option = {}, lineKey = '') {
  const key = String(lineKey || '').toLowerCase().trim()
  const text = `${option?.mainStock || ''} ${option?.name || ''}`.toLowerCase()
  if (!key || !text.trim()) return false
  if (/alloy|alloyed/.test(text)) return false
  if (key === 'gold') {
    return /gold/.test(text) && !/silver|copper|cadmium|platinum/.test(text)
  }
  if (key === 'silver') return /silver/.test(text)
  if (key === 'copper') return /copper/.test(text)
  if (key === 'cadmium') return /cadmium/.test(text)
  if (key === 'platinum') return /platinum/.test(text)
  // Unknown line key: fall back to name/mainStock containing the key.
  return text.includes(key)
}

/**
 * Input products for one stock row only (gold line → gold products, silver → silver, …).
 * Keeps the currently selected id even if it no longer matches, so the select stays valid.
 */
export function buildAlloyInputStockOptionsForLine(
  stockOptions = [],
  lineKey = '',
  { excludeIds = [], selectedId = '' } = {},
) {
  const base = buildAlloyInputStockOptions(stockOptions, { excludeIds })
  const matched = base.filter((row) => matchesAlloyLineMetal(row, lineKey))
  const selected = String(selectedId || '').trim()
  if (!selected) return matched
  if (matched.some((row) => String(row.id) === selected)) return matched
  const orphan = (Array.isArray(stockOptions) ? stockOptions : [])
    .find((row) => String(row.id) === selected)
  return orphan ? [orphan, ...matched] : matched
}

function optionPurityScore(option) {
  return normalizeAlloyPurity(option?.purity)
}

function catalogProductOptions(stockOptions = []) {
  const list = Array.isArray(stockOptions) ? stockOptions : []
  const products = list.filter((row) => row.kind === 'product')
  return products.length ? products : list
}

/** Prefer fine / near-1 purity gold for the mix gold line. */
export function pickPreferredFineGoldStock(stockOptions = []) {
  const list = catalogProductOptions(stockOptions)
  const goldish = list.filter((row) => (
    /gold/i.test(`${row.mainStock} ${row.name}`)
    && !/alloy|alloyed/i.test(`${row.mainStock} ${row.name}`)
  ))
  const pool = goldish.length ? goldish : list.filter((row) => !/alloy|alloyed/i.test(`${row.mainStock} ${row.name}`))
  const fineNamed = pool.find((row) => /fine|pure|9999|999\b|24\s*k|bar/i.test(row.name) && optionPurityScore(row) >= 0.99)
  if (fineNamed) return fineNamed
  const byPurity = [...pool].sort((a, b) => optionPurityScore(b) - optionPurityScore(a))
  const best = byPurity.find((row) => optionPurityScore(row) >= 0.99)
  return best || byPurity[0] || null
}

/** Prefer silver (or other non-gold) catalog product for the alloy metal line. */
export function pickPreferredAlloyMetalStock(stockOptions = []) {
  const list = catalogProductOptions(stockOptions)
  const silver = list.find((row) => /silver/i.test(`${row.mainStock} ${row.name}`))
  if (silver) return silver
  return list.find((row) => (
    !/gold/i.test(`${row.mainStock} ${row.name}`)
    || (/alloy|alloyed/i.test(`${row.mainStock} ${row.name}`) && optionPurityScore(row) < 0.2)
  )) || null
}

function formatAlloyPurityLabel(raw) {
  const p = normalizeAlloyPurity(raw)
  if (!(p > 0)) return ''
  return String(roundAlloyGrams(p, 4))
}

/** Finished alloyed-gold catalog hint for the selected karat (e.g. 22k Alloyed Gold). */
export function findFinishedAlloyProductHint(karat, stockOptions = []) {
  const recipe = resolveKaratRecipe(karat)
  const list = Array.isArray(stockOptions) ? stockOptions : []
  const karatNum = Number(karat)
  const targetPurity = recipe ? normalizeAlloyPurity(recipe.goldRatio) : 0
  const targetPurityLabel = formatAlloyPurityLabel(targetPurity)
  const byName = list.find((row) => {
    const text = `${row.name} ${row.mainStock}`.toLowerCase()
    const mentionsAlloy = /alloy|alloyed/.test(text)
    const mentionsKarat = new RegExp(`${karatNum}\\s*k`).test(text)
    return mentionsAlloy && mentionsKarat
  })
  if (byName) {
    const purityLabel = byName.purity || targetPurityLabel
    return {
      id: byName.id,
      name: byName.name,
      purity: purityLabel,
      message: `Finished product available: ${byName.name}${purityLabel ? ` (purity ${purityLabel})` : ''}. Ready to post mix when confirmed.`,
    }
  }
  const byPurity = list.find((row) => {
    if (!/alloy|alloyed/i.test(`${row.name} ${row.mainStock}`)) return false
    const p = optionPurityScore(row)
    return targetPurity > 0 && Math.abs(p - targetPurity) <= 0.01
  })
  if (byPurity) {
    const purityLabel = byPurity.purity || targetPurityLabel
    return {
      id: byPurity.id,
      name: byPurity.name,
      purity: purityLabel,
      message: `Finished product available: ${byPurity.name}${purityLabel ? ` (purity ${purityLabel})` : ''}. Ready to post mix when confirmed.`,
    }
  }
  const label = recipe?.label || `${karatNum}K`
  return {
    id: '',
    name: '',
    purity: targetPurityLabel,
    message: `No ${label} alloyed-gold product in inventory yet. Create one under Alloy (e.g. ${label} Alloyed Gold, purity ${targetPurityLabel || '—'}) when ready — optional.`,
  }
}

export function isAlloyExtraLineActive(line = {}) {
  return Boolean(String(line.stockId || '').trim())
    || Math.abs(Number(line.gross || 0)) > GROSS_EPS
    || Math.abs(Number(line.pure || 0)) > GROSS_EPS
}

/** Visible rows: always gold + alloy; extras only when active or showExtras. */
export function visibleAlloyLines(lines = [], { showExtras = false } = {}) {
  const list = Array.isArray(lines) ? lines : []
  return list.filter((line) => (
    line.role !== 'extra' || showExtras || isAlloyExtraLineActive(line)
  ))
}

/** Active consume lines for posting (stock + gross). */
export function activeAlloyMixLines(lines = []) {
  return (Array.isArray(lines) ? lines : []).filter((line) => (
    String(line.stockId || '').trim()
    && Math.abs(Number(line.gross || 0)) > GROSS_EPS
  ))
}

export function validateAlloyMixPost({
  karat,
  targetGross,
  lines = [],
  finishedProductId = '',
  stockOptions = [],
} = {}) {
  if (!Number(karat)) {
    return { ok: false, message: 'Select karat' }
  }
  const summary = summarizeAlloyLines(lines, targetGross)
  if (!summary.balanced) {
    return { ok: false, message: `Mix not balanced (${summary.checkLabel})` }
  }
  const finishedId = String(finishedProductId || '').trim()
  if (!finishedId) {
    return { ok: false, message: 'Select finished alloy product to receive' }
  }
  const finished = (Array.isArray(stockOptions) ? stockOptions : []).find((row) => row.id === finishedId)
  if (!finished) {
    return { ok: false, message: 'Finished product not found in inventory' }
  }
  const active = activeAlloyMixLines(lines)
  if (!active.length) {
    return { ok: false, message: 'Select input stocks with gross weight' }
  }
  if (active.some((line) => line.stockId === finishedId)) {
    return { ok: false, message: 'Finished product cannot also be an input stock' }
  }
  for (const line of active) {
    const option = (Array.isArray(stockOptions) ? stockOptions : []).find((row) => row.id === line.stockId)
    if (option && option.kind && option.kind !== 'product') {
      return {
        ok: false,
        message: `Use a catalog product for ${line.label || 'input'} (not a stock type)`,
      }
    }
    const onHand = Number(option?.quantity || 0)
    const need = Number(line.gross || 0)
    if (onHand + GROSS_EPS < need) {
      return {
        ok: false,
        message: `Insufficient stock for ${option?.name || line.label}. Available ${onHand} g, need ${need} g`,
      }
    }
  }
  return {
    ok: true,
    message: '',
    karat: Number(karat),
    targetGross: Number(targetGross),
    finishedProductId: finishedId,
    finishedName: finished.name,
    lines: active,
  }
}

export function buildAlloyMixPayload({
  karat,
  targetGross,
  finishedProductId,
  lines = [],
  description = '',
} = {}) {
  return {
    karat: Number(karat),
    targetGross: Number(targetGross),
    finishedProductId: String(finishedProductId || ''),
    lines: activeAlloyMixLines(lines).map((line) => ({
      itemId: String(line.stockId),
      gross: Number(line.gross),
      role: line.role || '',
      label: line.label || '',
    })),
    ...(description ? { description: String(description) } : {}),
  }
}

function alloyMixReasonBase(reason = '') {
  const text = String(reason || '')
  const matched = text.match(/^(.*) — (?:consume|receive)\b/i)
  return (matched ? matched[1] : text).trim()
}

/** Posted vs Updated — encoded in mix reason base when re-posted from Update/Edit. */
export function alloyMixStatusFromReason(reason = '') {
  return /\bupdated\b/i.test(String(reason || '')) ? 'updated' : 'posted'
}

/** Reason base for a new post (`posted`) or replace via Update/Edit (`updated`). */
export function buildAlloyMixReasonBase({
  karat,
  targetGross,
  status = 'posted',
} = {}) {
  const k = Number(karat)
  const target = roundAlloyGrams(Number(targetGross) || 0)
  const karatPart = Number.isFinite(k) && k > 0 ? `${k}K ` : ''
  const statusPart = String(status).toLowerCase() === 'updated' ? ' · updated' : ''
  return `Gold alloy mix (${karatPart}${target} g${statusPart})`
}

function isAlloyMixMovementReason(reason = '') {
  const text = String(reason || '')
  if (!/ — (?:consume|receive)\b/i.test(text)) return false
  return /alloy|alloyed|alloy\s*mix|gold alloy mix|\d+\s*k/i.test(text)
}

function inferAlloyLineMeta(nameOrLabel = '') {
  const text = String(nameOrLabel || '').toLowerCase()
  const template = GOLD_ALLOY_LINE_TEMPLATES.find((row) => (
    text === row.key || text === row.label || text.includes(row.key) || text.includes(row.label)
  ))
  if (template) return { key: template.key, label: template.label, role: template.role }
  if (/gold/i.test(text) && !/alloy/i.test(text)) return { key: 'gold', label: 'gold', role: 'gold' }
  if (/silver/i.test(text)) return { key: 'silver', label: 'silver', role: 'alloy' }
  if (/copper/i.test(text)) return { key: 'copper', label: 'copper', role: 'extra' }
  if (/cadmium/i.test(text)) return { key: 'cadmium', label: 'cadmium', role: 'extra' }
  if (/platinum/i.test(text)) return { key: 'platinum', label: 'platinum', role: 'extra' }
  return { key: '', label: String(nameOrLabel || '').trim(), role: 'extra' }
}

/** Build one posted-mix row from a successful postAlloyMix API result. */
export function buildPostedAlloyMixEntryFromResult(result = {}, { at = new Date().toISOString() } = {}) {
  const karat = Number(result?.karat) || null
  const targetGross = Number(result?.targetGross) || 0
  const finishedName = result?.finishedProduct?.name || ''
  const finishedProductId = String(result?.finishedProduct?.id || '')
  const reason = String(result?.reason || '').trim()
  const consumed = (Array.isArray(result?.consumed) ? result.consumed : []).map((row) => {
    const meta = inferAlloyLineMeta(row.label || row.name || '')
    return {
      itemId: String(row.itemId || ''),
      name: row.name || row.label || '',
      gross: Number(row.gross) || 0,
      key: meta.key,
      label: meta.label || row.label || '',
      role: meta.role,
    }
  })
  return {
    id: `post-${at}-${finishedName}-${targetGross}`,
    at,
    karat,
    targetGross,
    finishedName,
    finishedProductId,
    finishedQtyAfter: Number(result?.finishedProduct?.quantity) || null,
    consumed,
    reason,
    status: alloyMixStatusFromReason(reason),
    actorName: '',
  }
}

/**
 * Group stock-ledger movements into posted alloy mixes (newest first).
 * Matches consume/receive pairs that share the same reason base.
 * Soft-deleted mixes (after Update/Delete reverse) stay as history rows so
 * both the prior Posted entry and the current Updated entry can show.
 */
export function buildPostedAlloyMixListFromMovements(movements = []) {
  const list = Array.isArray(movements) ? movements : []
  const groups = new Map()

  for (const move of list) {
    const reason = String(move?.reason || '')
    if (!isAlloyMixMovementReason(reason)) continue
    const base = alloyMixReasonBase(reason)
    if (!base) continue
    // Keep each reverse batch separate so prior Posted + current Updated both show.
    const deleted = Boolean(move.isDeleted)
    const delAt = deleted
      ? String(move.deletedAt || move.updatedAt || move.createdAt || '')
      : ''
    const groupKey = deleted ? `${base}::del::${delAt || 'hist'}` : `${base}::active`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: `mix-${groupKey}`,
        reason: base,
        at: move.createdAt || move.updatedAt || '',
        karat: null,
        targetGross: 0,
        finishedName: '',
        finishedProductId: '',
        finishedQtyAfter: null,
        consumed: [],
        status: alloyMixStatusFromReason(base),
        actorName: move.actorName || '',
        activeMoveCount: 0,
        deletedMoveCount: 0,
        deletedAt: deleted ? (delAt || null) : null,
      })
    }
    const entry = groups.get(groupKey)
    const when = move.createdAt || move.updatedAt || ''
    if (when && (!entry.at || String(when) > String(entry.at))) entry.at = when
    if (move.actorName) entry.actorName = move.actorName
    if (deleted) entry.deletedMoveCount += 1
    else entry.activeMoveCount += 1

    const change = Number(move.change || 0)
    if (change > 0 || /—\s*receive/i.test(reason)) {
      entry.finishedName = move.itemName || entry.finishedName
      entry.finishedProductId = String(move.itemId || entry.finishedProductId || '')
      entry.targetGross = Math.abs(change) || entry.targetGross
      entry.finishedQtyAfter = move.quantityAfter != null
        ? Number(move.quantityAfter)
        : entry.finishedQtyAfter
    } else if (change < 0 || /—\s*consume/i.test(reason)) {
      const labelMatch = reason.match(/—\s*consume\s+(.+)$/i)
      const labelHint = labelMatch ? labelMatch[1].trim() : (move.itemName || '')
      const meta = inferAlloyLineMeta(labelHint || move.itemName || '')
      const itemId = String(move.itemId || '')
      const gross = Math.abs(change)
      // One consume line per input item within a batch (avoid dupes if ledger noise).
      const existing = entry.consumed.find((row) => String(row.itemId) === itemId)
      if (existing) {
        existing.gross = roundAlloyGrams(Number(existing.gross || 0) + gross)
      } else {
        entry.consumed.push({
          itemId,
          name: move.itemName || '',
          gross,
          key: meta.key,
          label: meta.label || labelHint,
          role: meta.role,
        })
      }
    }
  }

  const karatFromReason = (reason) => {
    const m = String(reason || '').match(/(\d+)\s*K/i)
    return m ? Number(m[1]) : null
  }

  const rows = [...groups.values()]
    .map((entry) => {
      const isHistory = entry.activeMoveCount === 0 && entry.deletedMoveCount > 0
      const status = entry.status || alloyMixStatusFromReason(entry.reason)
      return {
        id: entry.id,
        reason: entry.reason,
        at: entry.at,
        karat: entry.karat || karatFromReason(entry.reason),
        targetGross: entry.targetGross,
        finishedName: entry.finishedName,
        finishedProductId: entry.finishedProductId,
        finishedQtyAfter: isHistory ? null : entry.finishedQtyAfter,
        consumed: entry.consumed.filter((row) => row.gross > 0),
        status,
        isHistory,
        deletedAt: entry.deletedAt,
        actorName: entry.actorName,
      }
    })
    .filter((entry) => entry.finishedName || entry.consumed.length)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))

  // Keep every posted / updated / prior history row (newest first).
  return rows
}

/**
 * Group posted/updated/prior mixes that share the same finished product (+ karat)
 * so Posted → Updated lineage shows as one linked block (newest first within group).
 */
export function groupPostedAlloyMixes(mixes = []) {
  const list = Array.isArray(mixes) ? mixes : []
  const groups = new Map()

  for (const row of list) {
    const finishedKey = String(row?.finishedProductId || row?.finishedName || 'unknown')
    const karatKey = row?.karat != null && row?.karat !== '' ? String(row.karat) : 'any'
    const key = `${finishedKey}::${karatKey}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: `group-${key}`,
        key,
        finishedProductId: String(row?.finishedProductId || ''),
        finishedName: row?.finishedName || '',
        karat: row?.karat ?? null,
        rows: [],
      })
    }
    const group = groups.get(key)
    group.rows.push(row)
    if (!group.finishedName && row?.finishedName) group.finishedName = row.finishedName
    if (group.karat == null && row?.karat != null) group.karat = row.karat
  }

  const result = [...groups.values()].map((group) => {
    const rows = [...group.rows].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    const head = rows[0] || null
    const hasActive = rows.some((row) => !row.isHistory)
    return {
      ...group,
      rows: rows.map((row, index) => ({
        ...row,
        groupId: group.id,
        groupIndex: index,
        groupSize: rows.length,
        isGroupHead: index === 0,
        linkedPrior: index > 0,
      })),
      head,
      hasActive,
      at: head?.at || '',
    }
  })

  return result.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

/** Prefill blank mix lines from a posted mix row (for Edit). */
export function buildAlloyLinesFromPostedMix(posted = {}) {
  const consumed = Array.isArray(posted?.consumed) ? posted.consumed : []
  return consumed.map((row) => {
    const meta = inferAlloyLineMeta(row.label || row.key || row.name || '')
    const key = row.key || meta.key || String(row.itemId || row.name || Math.random())
    const label = row.label || meta.label || key
    const role = row.role || meta.role || 'extra'
    const gross = Number(row.gross) || 0
    const purity = role === 'extra' && !row.itemId ? '' : '1'
    return {
      key,
      label,
      role,
      stockId: String(row.itemId || ''),
      stockLabel: row.name || '',
      gross: gross > 0 ? gross : '',
      purity,
      pure: computeAlloyPure(gross, purity || '1'),
    }
  })
}

/** Convert catalog purity fraction (0.75) to percent display (75). */
export function alloyPurityToPercent(raw) {
  const frac = normalizeAlloyPurity(raw)
  if (!(frac > 0)) return ''
  return String(roundAlloyGrams(frac * 100, 4))
}

/** Convert percent input (75) to catalog purity fraction string (0.75). */
export function alloyPercentToPurityFraction(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return ''
  const frac = n > 1.2 ? n / 100 : n
  return String(roundAlloyGrams(frac, 6))
}

/** Patch productPurity= in an inventory category string. */
export function patchInventoryCategoryPurity(category = '', purityFraction) {
  const frac = normalizeAlloyPurity(purityFraction)
  if (!(frac > 0)) return String(category || '')
  const value = String(roundAlloyGrams(frac, 6))
  const parts = String(category || '').split(';').map((p) => p.trim()).filter(Boolean)
  let found = false
  const next = parts.map((part) => {
    if (/^productPurity=/i.test(part)) {
      found = true
      return `productPurity=${value}`
    }
    if (/^purity=/i.test(part) && !/^productPurity=/i.test(part)) {
      return part
    }
    return part
  })
  if (!found) next.push(`productPurity=${value}`)
  return next.join(';')
}

/**
 * Finished-product update form values from a posted mix + catalog stock options.
 * Purity is shown as percent (e.g. 75 for 18K).
 */
export function buildFinishedUpdateFormFromPosted(posted = {}, stockOptions = []) {
  const finishedId = String(posted?.finishedProductId || '')
  const finished = (Array.isArray(stockOptions) ? stockOptions : [])
    .find((row) => String(row.id) === finishedId)
  const recipe = resolveKaratRecipe(posted?.karat)
  const purityRaw = finished?.purity || (recipe ? recipe.goldRatio / 100 : '')
  return {
    finishedProductId: finishedId,
    finishedName: posted?.finishedName || finished?.name || '',
    gross: posted?.targetGross != null && posted?.targetGross !== ''
      ? String(posted.targetGross)
      : '',
    purityPercent: alloyPurityToPercent(purityRaw),
  }
}

/**
 * Scale posted input metals to a new finished gross.
 * Preserves each metal's original share of the posted mix (so custom silver/copper
 * splits stay), e.g. gold 200 @ 266.6667 → 199.5 @ 266 (metal loss -0.5).
 * Falls back to karat recipe only when the posted mix has no usable original target.
 */
export function buildAlloyLinesForFinishedGrossUpdate(posted = {}, {
  targetGross,
  goldRatio,
  alloyRatio,
} = {}) {
  const base = buildAlloyLinesFromPostedMix(posted)
  const oldTarget = Number(posted?.targetGross)
  const nextTarget = Number(targetGross)
  const originalSum = roundAlloyGrams(
    base.reduce((sum, line) => sum + Number(line.gross || 0), 0),
  )
  const scaleFrom = oldTarget > 0 ? oldTarget : originalSum

  if (nextTarget > 0 && scaleFrom > 0) {
    const factor = nextTarget / scaleFrom
    const scaled = base.map((line) => {
      const originalGross = Number(line.gross) || 0
      const gross = originalGross > 0 ? roundAlloyGrams(originalGross * factor) : ''
      const purity = line.purity === '' || line.purity == null ? '1' : line.purity
      return {
        ...line,
        gross,
        purity,
        pure: computeAlloyPure(gross, purity),
      }
    })
    // Last positive row absorbs rounding so metals always equal finished target.
    const positiveIdx = scaled
      .map((line, idx) => (Number(line.gross) > 0 ? idx : -1))
      .filter((idx) => idx >= 0)
    if (positiveIdx.length > 1) {
      const lastIdx = positiveIdx[positiveIdx.length - 1]
      const others = roundAlloyGrams(
        scaled.reduce((sum, line, idx) => (
          idx === lastIdx ? sum : sum + (Number(line.gross) || 0)
        ), 0),
      )
      const lastGross = roundAlloyGrams(nextTarget - others)
      const last = scaled[lastIdx]
      const purity = last.purity === '' || last.purity == null ? '1' : last.purity
      scaled[lastIdx] = {
        ...last,
        gross: lastGross,
        pure: computeAlloyPure(lastGross, purity),
      }
    }
    return scaled
  }

  const recipe = resolveKaratRecipe(posted?.karat)
  const nextGold = goldRatio !== '' && goldRatio != null
    ? goldRatio
    : (recipe?.goldRatio ?? '')
  const nextAlloy = alloyRatio !== '' && alloyRatio != null
    ? alloyRatio
    : (recipe?.alloyRatio ?? '')
  return applyAlloyRecipeToLines(base, {
    targetGross,
    goldRatio: nextGold,
    alloyRatio: nextAlloy,
  })
}

/** Metal loss = new gross − original posted gross (e.g. 199.5 − 200 = −0.5). */
export function computeAlloyMetalLoss(newGross, originalGross) {
  return roundAlloyGrams(Number(newGross || 0) - Number(originalGross || 0))
}

/** Share of mix = line gross ÷ finished/allowed gross (e.g. 199.5 / 266 ≈ 0.75). */
export function computeAlloyMixShare(lineGross, finishedGross) {
  const g = Number(lineGross)
  const t = Number(finishedGross)
  if (!(g > 0) || !(t > 0)) return ''
  return String(roundAlloyGrams(g / t, 6))
}

/**
 * Format Gold Alloy Update AML loss for Ops Production + Production Dashboard.
 * Floor Metal Loss (IN−OUT) stays separate — this is ERP oxidation / this-Update grams.
 */

const STOCK_SHORT = {
  XAU: 'Au',
  XAG: 'Ag',
  XCU: 'Cu',
  XPT: 'Pt',
}

function roundG(n, digits = 4) {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  const f = 10 ** digits
  return Math.round(x * f) / f
}

function metalShortLabel(row = {}) {
  const code = String(row.stockCode || '').trim().toUpperCase()
  if (STOCK_SHORT[code]) return STOCK_SHORT[code]
  const name = String(row.name || row.label || '').toLowerCase()
  if (/\bcopper\b|\bxcu\b|\bcu\b/.test(name)) return 'Cu'
  if (/\bsilver\b|\bxag\b|\bag\b/.test(name)) return 'Ag'
  if (/\bplatinum\b|\bxpt\b|\bpt\b/.test(name)) return 'Pt'
  if (/\bgold\b|\bxau\b|\bau\b/.test(name)) return 'Au'
  return String(row.name || row.label || code || 'Metal').trim() || 'Metal'
}

/**
 * Split AML loss into head + metal addons for stacked Ops cells:
 *   Alloy loss 0.794 g
 *   Au 0.728  Cu 0.066
 */
export function formatAlloyMetalLossParts(jobOrLoss = {}) {
  const byMetal = Array.isArray(jobOrLoss?.metalLossByMetal)
    ? jobOrLoss.metalLossByMetal
    : (Array.isArray(jobOrLoss) ? jobOrLoss : [])
  const metals = []
  for (const row of byMetal) {
    const g = roundG(row?.lossGross)
    if (!(g > 0)) continue
    metals.push(`${metalShortLabel(row)} ${g}`)
  }
  const total = roundG(
    jobOrLoss?.metalLossGross != null
      ? jobOrLoss.metalLossGross
      : metals.length
        ? byMetal.reduce((sum, row) => sum + (Number(row?.lossGross) || 0), 0)
        : 0,
  )
  if (!(total > 0) && !metals.length) return null
  return {
    total: total > 0 ? total : null,
    head: total > 0 ? `Alloy loss ${total} g` : (metals.length ? 'Alloy loss' : null),
    metalsLine: metals.length ? metals.join('  ') : null,
    metals,
  }
}

/** Single-line label for titles / dashboard: "Alloy loss 0.703 g · Au 0.644 · Cu 0.059". */
export function formatAlloyMetalLossLabel(jobOrLoss = {}) {
  const parts = formatAlloyMetalLossParts(jobOrLoss)
  if (!parts) return null
  if (parts.metalsLine) {
    return `${parts.head} · ${parts.metals.join(' · ')}`
  }
  return parts.head
}

/** Map mixCode → job (prefer live / non-closed when duplicates). */
export function indexAlloyMixJobsByCode(jobs = []) {
  const map = {}
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const code = String(job?.mixCode || '').trim().toUpperCase()
    if (!code || code.includes('__REV__')) continue
    const existing = map[code]
    if (!existing) {
      map[code] = job
      continue
    }
    const existingClosed = String(existing.status || '') === 'closed'
    const nextClosed = String(job.status || '') === 'closed'
    if (existingClosed && !nextClosed) map[code] = job
  }
  return map
}

function formatGramsDisplay(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const rounded = roundG(value)
  if (rounded == null) return '—'
  return `${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })} g`
}

/**
 * On the open "Now here" custody row only: show path Metal Loss total + AML Au/Cu
 * addon breakdown. Does not write metalLoss (keeps null) so sheet / dashboard
 * summaries do not double-count Melting + Rolling + this row.
 */
export function enrichAlloyCurrentHereLoss(rows = [], jobsByCode = {}) {
  const list = Array.isArray(rows) ? rows : []
  const byCode = new Map()
  for (const row of list) {
    if (!row?.fromGoldAlloy) continue
    const code = String(row.alloyMixCode || row.batch || '').trim().toUpperCase()
    if (!code) continue
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code).push(row)
  }

  for (const [code, group] of byCode) {
    const here = group.find((r) => r.alloyCurrentHere)
    if (!here) continue

    const floorTotal = roundG(group.reduce((sum, row) => {
      if (row === here) return sum
      const n = Number(row.metalLoss)
      return sum + (Number.isFinite(n) && n > 0 ? n : 0)
    }, 0)) || 0

    const job = jobsByCode?.[code] || null
    const amlTotal = roundG(job?.metalLossGross)
    const total = (amlTotal != null && amlTotal > 0)
      ? amlTotal
      : (floorTotal > 0 ? floorTotal : null)
    if (!(total > 0)) continue

    const origin = [...group]
      .filter((r) => r.metalIn != null && Number.isFinite(Number(r.metalIn)))
      .sort((a, b) => {
        const ta = a.batchStartedRaw ? new Date(a.batchStartedRaw).getTime() : 0
        const tb = b.batchStartedRaw ? new Date(b.batchStartedRaw).getTime() : 0
        return ta - tb
      })[0]
    const originIn = Number(origin?.metalIn)
    const purity = Number(here.purity ?? origin?.purity)

    const fineSum = roundG(group.reduce((sum, row) => {
      if (row === here) return sum
      const n = Number(row.fineLoss)
      return sum + (Number.isFinite(n) && n > 0 ? n : 0)
    }, 0)) || 0
    const fineApprox = Number.isFinite(purity) && purity > 0
      ? roundG(total * (purity / 100))
      : null

    const lossSrc = job && (Number(job.metalLossGross) > 0 || (job.metalLossByMetal || []).length)
      ? job
      : { metalLossGross: total }
    const alloyParts = formatAlloyMetalLossParts(lossSrc)

    // Display-only — leave metalLoss null so totals stay Melting+Rolling only.
    here.alloyLossCumulative = true
    here.metalLossDisplay = formatGramsDisplay(total)
    here.lossPct = (Number.isFinite(originIn) && originIn > 0)
      ? Math.round((total / originIn) * 10000) / 100
      : null
    here.fineLoss = fineSum > 0 ? fineSum : fineApprox
    here.alloyLossLabel = formatAlloyMetalLossLabel(lossSrc)
    here.alloyLossHead = alloyParts?.head || null
    here.alloyLossMetals = alloyParts?.metalsLine || null
  }

  return list
}

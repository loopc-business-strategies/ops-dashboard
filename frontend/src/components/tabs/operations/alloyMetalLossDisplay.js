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

function roundG(n, digits = 3) {
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

/** Build "Alloy loss 0.703 g · Au 0.644 · Cu 0.059" (or null when nothing to show). */
export function formatAlloyMetalLossLabel(jobOrLoss = {}) {
  const byMetal = Array.isArray(jobOrLoss?.metalLossByMetal)
    ? jobOrLoss.metalLossByMetal
    : (Array.isArray(jobOrLoss) ? jobOrLoss : [])
  const parts = []
  for (const row of byMetal) {
    const g = roundG(row?.lossGross)
    if (!(g > 0)) continue
    parts.push(`${metalShortLabel(row)} ${g}`)
  }
  const total = roundG(
    jobOrLoss?.metalLossGross != null
      ? jobOrLoss.metalLossGross
      : parts.length
        ? byMetal.reduce((sum, row) => sum + (Number(row?.lossGross) || 0), 0)
        : 0,
  )
  if (!(total > 0) && !parts.length) return null
  if (parts.length) {
    const head = total > 0 ? `Alloy loss ${total} g` : 'Alloy loss'
    return `${head} · ${parts.join(' · ')}`
  }
  return `Alloy loss ${total} g`
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

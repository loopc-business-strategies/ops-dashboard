/**
 * Helpers for Operations › Allocate Metal Out (same payload shape as MG Floor tablet).
 */

const pad = (n) => String(n).padStart(2, '0')
const ALLOY_MIX_BATCH_RE = /^(?:BMG|AMX)-/i

/** Local calendar day YYYY-MM-DD (tablet-local day unit). */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function clockNow(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function isAlloyMixBatchCode(value) {
  return ALLOY_MIX_BATCH_RE.test(String(value || '').trim())
}

/** Short label for Post Mix composition chips (Gold / Copper / …). */
export function shortMixMetalLabel(name = '') {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return ''
  if (/gold|xau|au\b/.test(n)) return 'Gold'
  if (/copper|cu\b/.test(n)) return 'Copper'
  if (/silver|xag|ag\b/.test(n)) return 'Silver'
  if (/platinum|xpt|pt\b/.test(n)) return 'Platinum'
  if (/palladium|xpd|pd\b/.test(n)) return 'Palladium'
  return String(name || '').trim()
}

/** Same rounding as Gold Alloy View mix share (g / finished). */
function roundMixShare(value, places = 6) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = 10 ** places
  return Math.round(n * f) / f
}

function roundMixGrams(value, places = 3) {
  return roundMixShare(value, places)
}

/**
 * View-mix style input grams: if stored consume sum exceeds finished target
 * (Update metal loss), scale to remain so share = remain ÷ target.
 */
function mixComponentsForShare(job) {
  const components = Array.isArray(job?.inputComponents) ? job.inputComponents : []
  const rows = []
  for (const row of components) {
    const name = String(row?.name || row?.label || '').trim()
    const gross = Number(row?.gross)
    if (!name || !(gross > 0)) continue
    if (/^alloy$/i.test(name) || /alloyed\s+gold/i.test(name)) continue
    rows.push({ name, gross })
  }
  const target = Number(job?.targetGross) > 0
    ? Number(job.targetGross)
    : rows.reduce((sum, row) => sum + row.gross, 0)
  const sum = rows.reduce((acc, row) => acc + row.gross, 0)
  if (!(target > 0) || !(sum > target + 0.0005)) {
    return { target, rows }
  }
  let allocated = 0
  const scaled = rows.map((row, index) => {
    const isLast = index === rows.length - 1
    const remain = isLast
      ? roundMixGrams(target - allocated)
      : roundMixGrams(row.gross * (target / sum))
    if (!isLast) allocated = roundMixGrams(allocated + remain)
    return { ...row, gross: remain }
  }).filter((row) => row.gross > 0)
  return { target, rows: scaled }
}

/**
 * Post Mix purity/share rows — same numbers as Gold Alloy "View mix":
 * finished 0.76, then each input share (fixed; does not change with Metal Out qty).
 */
export function postMixCompositionParts(job) {
  const { target, rows } = mixComponentsForShare(job)
  const parts = []
  const purityPct = job?.purity != null && Number(job.purity) > 0 ? Number(job.purity) : null
  if (purityPct != null) {
    const finishedFrac = purityPct > 1.2 && purityPct <= 100 ? purityPct / 100 : purityPct
    if (finishedFrac > 0 && finishedFrac <= 1.2) {
      parts.push({
        label: 'finished',
        share: roundMixShare(finishedFrac, 2),
        shareText: roundMixShare(finishedFrac, 2).toFixed(2),
      })
    }
  }
  for (const row of rows) {
    const share = target > 0 ? roundMixShare(row.gross / target, 6) : 0
    if (!(share > 0)) continue
    parts.push({
      label: shortMixMetalLabel(row.name),
      share,
      shareText: String(share),
    })
  }
  return parts
}

/** Joined label for titles/tests: "finished 0.76 · Gold 0.9 · Copper 0.1". */
export function postMixCompositionLabel(job) {
  return postMixCompositionParts(job)
    .map(({ label, shareText }) => `${label} ${shareText}`)
    .join(' · ')
}

/**
 * One Metal Out row for a Gold Alloy batch: finished product from Post Mix.
 * Purity column = View-mix style share chips (0.76 / 0.9 / 0.1), fixed when Gross changes.
 * `purityValue` keeps finished fine-gold % for the API / fine-gold calc.
 */
export function finishedMetalOutLineFromJob(job, { time = '' } = {}) {
  const karat = Number(job?.karat)
  const metal = String(job?.finishedProductName || '').trim()
    || (Number.isFinite(karat) && karat > 0 ? `${karat}K alloyed gold` : 'Alloyed gold')
  const purityNum = job?.purity != null && Number(job.purity) > 0
    ? Math.round(Number(job.purity) * 1000) / 1000
    : null
  const compositionParts = postMixCompositionParts(job)
  const composition = compositionParts.map(({ label, shareText }) => `${label} ${shareText}`).join(' · ')
  return {
    metal,
    qty: '',
    purity: composition || (purityNum != null ? String(purityNum) : ''),
    purityValue: purityNum,
    compositionParts,
    time: time || '',
    lockedMetal: true,
    lockedPurity: true,
  }
}

/** Prefill OUT lines from alloy mix input components (exclude finished Alloy product). */
export function linesFromJobInputComponents(components = []) {
  if (!Array.isArray(components) || !components.length) return []
  const lines = []
  for (const row of components) {
    const metal = String(row?.name || row?.label || '').trim()
    const qty = Number(row?.gross)
    if (!metal || !(qty > 0)) continue
    if (/^alloy$/i.test(metal) || /alloyed\s+gold/i.test(metal)) continue
    lines.push({
      metal,
      qty: String(Math.round(qty * 1000) / 1000),
      purity: '',
      time: '',
    })
  }
  return lines
}

export function blankMetalOutLine(metal = '') {
  return { metal, qty: '', purity: '', time: '' }
}

function parseNumber(raw) {
  const text = String(raw ?? '').trim().replace(',', '.')
  if (!text) return { empty: true, value: null }
  const value = Number(text)
  return { empty: false, value: Number.isFinite(value) ? value : null }
}

function normalizeTime(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const m = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

/**
 * Build API lines from editable rows. Empty rows skipped; qty required when row has data.
 */
export function prepareMetalOutLines(rows = [], now = new Date()) {
  const lines = []
  for (const row of rows) {
    const metal = String(row?.metal || '').trim()
    const qty = parseNumber(row?.qty)
    // Alloy locked rows show composition text in `purity`; submit finished % via purityValue.
    const purityFromValue = row?.purityValue != null && Number(row.purityValue) > 0
      ? { empty: false, value: Number(row.purityValue) }
      : null
    const purity = purityFromValue || parseNumber(row?.purity)
    const timeRaw = String(row?.time || '').trim()
    const purityLooksLikeText = !purityFromValue && /%/.test(String(row?.purity || ''))
    if (!metal && qty.empty && (purity.empty || purityLooksLikeText) && !timeRaw) continue
    if (!metal) return { lines: [], error: 'Enter a metal name on each filled row' }
    // Exact "Alloy" is Metal In only; finished names like "22k alloyed gold" are allowed on BMG OUT.
    if (/^alloy$/i.test(metal)) return { lines: [], error: 'Alloy is not allowed on Metal Out' }
    if (qty.empty) return { lines: [], error: `Enter Qty for ${metal}` }
    if (qty.value == null || qty.value <= 0) {
      return { lines: [], error: `Qty for ${metal} must be a number above 0` }
    }
    if (!purity.empty && !purityLooksLikeText && (purity.value == null || purity.value <= 0 || purity.value > 1000)) {
      return { lines: [], error: `Purity for ${metal} must be between 0 and 1000` }
    }
    const typedTime = normalizeTime(timeRaw)
    if (typedTime == null) {
      return { lines: [], error: `Time for ${metal} must be like 14:30` }
    }
    lines.push({
      metal,
      qty: qty.value,
      purity: purity.empty || purityLooksLikeText ? (purityFromValue?.value ?? null) : purity.value,
      time: typedTime || clockNow(now),
    })
  }
  if (!lines.length) return { lines: [], error: 'Enter Qty for at least one metal' }
  return { lines, error: null }
}

export function newBatchEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `amxout${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  }
  return `amxout${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function buildMetalOutPayload({
  job,
  lines,
  entryDate = localDateKey(),
  now = new Date(),
} = {}) {
  const batchLabel = String(job?.mixCode || '').trim().toUpperCase()
  const department = String(job?.currentDepartment || '').trim()
  const prepared = prepareMetalOutLines(lines, now)
  if (prepared.error) return { error: prepared.error, body: null }
  if (!batchLabel) return { error: 'Mix code is required', body: null }
  if (!department) return { error: 'Department is required', body: null }
  return {
    error: null,
    body: {
      entryId: newBatchEntryId(),
      direction: 'OUT',
      department,
      batchLabel,
      entryDate,
      deviceId: 'ops-allocate-web',
      tzOffsetMinutes: -now.getTimezoneOffset(),
      lines: prepared.lines,
    },
  }
}

/** True when an active (non-rejected) Metal Out already exists for this batch/day. */
export function hasActiveMetalOut(entries = [], { batchLabel, entryDate, department } = {}) {
  const label = String(batchLabel || '').trim().toUpperCase()
  const day = String(entryDate || '').trim()
  const dept = String(department || '').trim().toLowerCase()
  return (Array.isArray(entries) ? entries : []).some((e) => {
    if (String(e?.direction || '').toUpperCase() !== 'OUT') return false
    if (String(e?.status || '').toUpperCase() === 'REJECTED') return false
    if (String(e?.batchLabel || '').trim().toUpperCase() !== label) return false
    if (day && String(e?.entryDate || '') !== day) return false
    if (dept && String(e?.department || '').trim().toLowerCase() !== dept) return false
    return true
  })
}

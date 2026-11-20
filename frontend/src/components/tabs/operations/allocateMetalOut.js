/**
 * Helpers for Operations › Allocate Metal Out (same payload shape as MG Floor tablet).
 */

const pad = (n) => String(n).padStart(2, '0')

/** Local calendar day YYYY-MM-DD (tablet-local day unit). */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function clockNow(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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
    const purity = parseNumber(row?.purity)
    const timeRaw = String(row?.time || '').trim()
    if (!metal && qty.empty && purity.empty && !timeRaw) continue
    if (!metal) return { lines: [], error: 'Enter a metal name on each filled row' }
    if (/^alloy$/i.test(metal)) return { lines: [], error: 'Alloy is not allowed on Metal Out' }
    if (qty.empty) return { lines: [], error: `Enter Qty for ${metal}` }
    if (qty.value == null || qty.value <= 0) {
      return { lines: [], error: `Qty for ${metal} must be a number above 0` }
    }
    if (!purity.empty && (purity.value == null || purity.value <= 0 || purity.value > 1000)) {
      return { lines: [], error: `Purity for ${metal} must be between 0 and 1000` }
    }
    const typedTime = normalizeTime(timeRaw)
    if (typedTime == null) {
      return { lines: [], error: `Time for ${metal} must be like 14:30` }
    }
    lines.push({
      metal,
      qty: qty.value,
      purity: purity.empty ? null : purity.value,
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

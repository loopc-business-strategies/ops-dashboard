/** Same rule as the tablet: a % above 0 and up to 100, two decimals; "0,5" and "0.5%" are accepted. */
export function parseLossLimitInput(text) {
  const cleaned = String(text ?? '').trim().replace('%', '').replace(',', '.').trim()
  if (!cleaned) return { error: 'Enter a limit, e.g. 0.5' }
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return { error: 'Enter a % between 0 and 100, e.g. 0.5' }
  return { value: Math.round(n * 100) / 100 }
}

/**
 * What the row offers for the typed text: 'clean' (nothing to save), 'dirty' (Save; checked on
 * submit) or 'cleared' (box emptied on a saved limit → Remove).
 */
export function limitEditState(text, saved) {
  const typed = String(text ?? '').trim()
  if (!typed) return saved == null ? 'clean' : 'cleared'
  return parseLossLimitInput(typed).value === saved ? 'clean' : 'dirty'
}

/** Average loss over the limit → red; within 80% of it → amber. */
export function lossTone(avgLossPct, limitPct) {
  if (avgLossPct == null || limitPct == null) return 'none'
  if (avgLossPct > limitPct) return 'over'
  if (avgLossPct >= limitPct * 0.8) return 'near'
  return 'ok'
}

export const formatPct = (value) => (value == null ? '—' : `${Number(value).toFixed(2)}%`)

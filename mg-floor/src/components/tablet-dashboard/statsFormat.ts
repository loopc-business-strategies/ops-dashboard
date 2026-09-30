const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type StatTone = 'neutral' | 'good' | 'bad'

/** 45 → "45m", 445 → "7h 25m". */
export function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null || !Number.isFinite(minutes)) return '--'
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Grams with up to 3 decimals: 10.2 → "10.2 g". */
export function formatGrams(grams: number | null | undefined) {
  if (grams == null || !Number.isFinite(grams)) return '--'
  return `${Number(grams.toFixed(3))} g`
}

export function formatPct(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct)) return ''
  return `${Number(pct.toFixed(2))}%`
}

export function elapsedMinutes(startedAt: string, now: number) {
  const start = new Date(startedAt).getTime()
  return Number.isFinite(start) ? Math.max(0, (now - start) / 60000) : null
}

export function isOverLimit(pct: number | null | undefined, limit: number | null | undefined) {
  return limit != null && pct != null && pct > limit
}

/** "Batch 2" for today, "Batch 9 · 20 Sep" for another day. */
export function batchRefLabel(ref: { batchNumber: string; date: string }, today: string) {
  const label = `Batch ${ref.batchNumber}`
  if (ref.date === today) return label
  const [, month, day] = ref.date.split('-').map(Number)
  return month && day ? `${label} · ${day} ${MONTHS[month - 1]}` : label
}

/** Today's average batch time against the all-time average. */
export function compareToOverall(todayMinutes: number | null | undefined, overallMinutes: number | null | undefined): { text: string; tone: StatTone } | null {
  if (todayMinutes == null || overallMinutes == null) return null
  const diff = Math.round(todayMinutes - overallMinutes)
  if (Math.abs(diff) < 1) return { text: 'Same as usual', tone: 'neutral' }
  return diff < 0
    ? { text: `▼ ${formatMinutes(-diff)} faster than usual`, tone: 'good' }
    : { text: `▲ ${formatMinutes(diff)} slower than usual`, tone: 'bad' }
}

/** Accepts "0.5", "0,5" or "0.5%"; null when empty; NaN when not a valid limit. */
export function parseLossLimit(text: string): number | null {
  const cleaned = text.trim().replace('%', '').replace(',', '.').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 100) / 100 : NaN
}

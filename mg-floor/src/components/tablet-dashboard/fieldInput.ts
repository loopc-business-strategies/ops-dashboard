export const QTY_MAX_LENGTH = 9
export const PURITY_MAX_LENGTH = 6
export const TIME_MAX_LENGTH = 5

/** Keep digits and one decimal point; a comma counts as the decimal point. */
export function cleanNumberInput(raw: string, maxLength: number) {
  const text = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const dot = text.indexOf('.')
  const single = dot === -1 ? text : text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '')
  return single.slice(0, maxLength)
}

/**
 * Format a time while it is typed. The colon goes in by itself once the hour is known
 * (1430 → 14:30, 930 → 9:30), and '.', ',' or ':' typed after the hour also works as the colon.
 */
export function formatTimeTyping(raw: string) {
  const sep = /[.,:;\s-]/.exec(raw)
  if (sep) {
    const hours = raw.slice(0, sep.index).replace(/\D/g, '').slice(0, 2)
    const minutes = raw.slice(sep.index + 1).replace(/\D/g, '').slice(0, 2)
    return hours ? `${hours}:${minutes}` : minutes
  }
  const digits = raw.replace(/\D/g, '')
  const singleHour = digits[0] > '2' || (digits[0] === '2' && digits[1] > '3')
  const hourLength = singleHour ? 1 : 2
  if (digits.length <= hourLength) return digits
  return `${digits.slice(0, hourLength)}:${digits.slice(hourLength, hourLength + 2)}`
}

/** True once the typed hour or minutes can no longer be a real time (not just unfinished). */
export function isImpossibleTime(raw: string) {
  const [hours = '', minutes = ''] = formatTimeTyping(raw).split(':')
  return Number(hours) > 23 || (minutes.length === 2 && Number(minutes) > 59)
}

/** Typed time as HH:MM, '' when empty, or null when it is not a real time. */
export function normalizeTime(raw: string): string | null {
  const text = formatTimeTyping(raw.trim())
  if (!text) return ''
  const [hours, minutes = ''] = text.split(':')
  if (!hours || minutes.length === 1) return null
  const h = Number(hours)
  const m = minutes ? Number(minutes) : 0
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

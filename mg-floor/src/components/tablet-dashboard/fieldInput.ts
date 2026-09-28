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

/** Keep digits and one colon; '.', ',' or a space typed as the separator becomes ':'. */
export function cleanTimeInput(raw: string) {
  const text = raw.replace(/[.,;\s-]/g, ':').replace(/[^0-9:]/g, '')
  const colon = text.indexOf(':')
  const single = colon === -1 ? text : text.slice(0, colon + 1) + text.slice(colon + 1).replace(/:/g, '')
  return single.slice(0, TIME_MAX_LENGTH)
}

/**
 * Typed time as HH:MM, or null when it is not a real time. Accepts 22:45, 9:05, 2245, 945 and a
 * bare hour (9 → 09:00). Empty input returns ''.
 */
export function normalizeTime(raw: string): string | null {
  const text = cleanTimeInput(raw.trim())
  if (!text) return ''
  let hours: string
  let minutes: string
  const parts = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (parts) {
    hours = parts[1]
    minutes = parts[2]
  } else if (/^\d{1,2}$/.test(text)) {
    hours = text
    minutes = '00'
  } else if (/^\d{3,4}$/.test(text)) {
    hours = text.slice(0, -2)
    minutes = text.slice(-2)
  } else {
    return null
  }
  const h = Number(hours)
  const m = Number(minutes)
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${minutes}`
}

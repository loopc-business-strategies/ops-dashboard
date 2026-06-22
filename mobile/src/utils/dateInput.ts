const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDateInput(value: string): boolean {
  const raw = String(value || '').trim()
  if (!raw) return true
  if (!ISO_DATE_RE.test(raw)) return false
  const date = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return false
  return date.toISOString().slice(0, 10) === raw
}

export function normalizeDateInput(value: string): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (!isValidDateInput(raw)) return raw
  return raw
}

export function formatDateToInput(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateInput(value: string): Date | null {
  const raw = normalizeDateInput(value)
  if (!raw || !isValidDateInput(raw)) return null
  return new Date(`${raw}T12:00:00.000Z`)
}

export function validateDateRange(
  startDate: string,
  endDate: string,
): { ok: true } | { ok: false; message: string } {
  const start = normalizeDateInput(startDate)
  const end = normalizeDateInput(endDate)

  if (start && !isValidDateInput(start)) {
    return { ok: false, message: 'From date must be YYYY-MM-DD.' }
  }
  if (end && !isValidDateInput(end)) {
    return { ok: false, message: 'To date must be YYYY-MM-DD.' }
  }
  if (start && end && start > end) {
    return { ok: false, message: 'From date cannot be after To date.' }
  }
  return { ok: true }
}

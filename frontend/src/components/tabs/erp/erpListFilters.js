export const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
]

export function normalizeFilterSearchTerm(value) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeFilterYear(value) {
  const year = String(value || '').trim()
  return /^\d{4}$/.test(year) ? year : ''
}

export function normalizeFilterMonths(values = []) {
  if (!Array.isArray(values)) return []
  const unique = new Set()
  values.forEach((value) => {
    const month = Number(value)
    if (Number.isInteger(month) && month >= 1 && month <= 12) {
      unique.add(month)
    }
  })
  return Array.from(unique).sort((a, b) => a - b)
}

export function selectAllMonths() {
  return MONTH_OPTIONS.map((option) => option.value)
}

export function areAllMonthsSelected(values = []) {
  return normalizeFilterMonths(values).length === MONTH_OPTIONS.length
}

export function toMonthCsv(values = []) {
  return normalizeFilterMonths(values).join(',')
}

export function fromMonthCsv(value) {
  return normalizeFilterMonths(String(value || '').split(','))
}

export function matchesYearMonths(dateValue, selectedYear, selectedMonths) {
  const year = normalizeFilterYear(selectedYear)
  const months = normalizeFilterMonths(selectedMonths)
  if (!year && !months.length) return true
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  if (year && String(date.getFullYear()) !== year) return false
  if (!months.length) return true
  return months.includes(date.getMonth() + 1)
}

export function includesSearchTerm(values, term) {
  const normalizedTerm = normalizeFilterSearchTerm(term)
  if (!normalizedTerm) return true
  if (!Array.isArray(values)) return false
  return values.some((value) => String(value || '').toLowerCase().includes(normalizedTerm))
}

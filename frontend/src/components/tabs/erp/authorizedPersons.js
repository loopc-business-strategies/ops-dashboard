/**
 * Authorized persons on chart accounts are stored as one string
 * (comma-separated) for backward compatibility with existing accounts.
 */

export function parseAuthorizedPersons(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/[,;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function serializeAuthorizedPersons(list) {
  return parseAuthorizedPersons(list).join(', ')
}

export function addAuthorizedPerson(list, name) {
  const next = String(name || '').trim()
  if (!next) return parseAuthorizedPersons(list)
  const current = parseAuthorizedPersons(list)
  if (current.some((entry) => entry.toLowerCase() === next.toLowerCase())) return current
  return [...current, next]
}

export function removeAuthorizedPersonAt(list, index) {
  return parseAuthorizedPersons(list).filter((_, i) => i !== index)
}

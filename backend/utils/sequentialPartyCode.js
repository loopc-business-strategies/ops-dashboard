function parsePrefixedSequence(code, prefix) {
  const normalizedPrefix = String(prefix || '').trim().toUpperCase()
  const normalizedCode = String(code || '').trim().toUpperCase()
  const pattern = new RegExp(`^${normalizedPrefix}-(\\d+)$`)
  const match = normalizedCode.match(pattern)
  if (!match) return null
  const sequence = Number(match[1])
  return Number.isFinite(sequence) ? sequence : null
}

function getMaxPrefixedSequence(codes = [], prefix = 'VEN') {
  let max = 0
  for (const code of codes) {
    const sequence = parsePrefixedSequence(code, prefix)
    if (sequence !== null) max = Math.max(max, sequence)
  }
  return max
}

function formatPrefixedCode(prefix, sequence, pad = 4) {
  return `${String(prefix).toUpperCase()}-${String(sequence).padStart(pad, '0')}`
}

function getNextPrefixedCode(codes = [], prefix = 'VEN', pad = 4) {
  return formatPrefixedCode(prefix, getMaxPrefixedSequence(codes, prefix) + 1, pad)
}

module.exports = {
  parsePrefixedSequence,
  getMaxPrefixedSequence,
  formatPrefixedCode,
  getNextPrefixedCode,
}

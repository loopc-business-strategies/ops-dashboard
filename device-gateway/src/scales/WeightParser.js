/**
 * Parse common continuous-output scale frames into grams.
 * MH-708 exact framing is configurable/verified on site — do not hard-code unverified protocol.
 */
function parseWeightFrame(raw, { unit = 'g' } = {}) {
  const text = String(raw || '').trim()
  if (!text) return null

  // Common patterns: "ST,GS,+  125.36 g" / " 125.36g" / "+125.36"
  const stableHint = /\bST\b|stable/i.test(text)
  const unstableHint = /\bUS\b|unstable/i.test(text)

  const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*(g|kg|oz)?/i)
  if (!match) return { parseError: true, rawData: text }

  let weight = Number(match[1])
  const parsedUnit = (match[2] || unit || 'g').toLowerCase()
  if (parsedUnit === 'kg') weight *= 1000

  return {
    weight,
    unit: 'g',
    stableHint: unstableHint ? false : stableHint ? true : null,
    rawData: text,
    parseError: false,
  }
}

module.exports = { parseWeightFrame }

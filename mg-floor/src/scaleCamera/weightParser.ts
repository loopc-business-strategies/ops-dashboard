import { decimalsForResolution } from './cameraSettings'

export type WeightParseFailure =
  | 'NO_READING'
  | 'INVALID_CHARACTERS'
  | 'WRONG_FORMAT'
  | 'AMBIGUOUS'
  | 'NEGATIVE'
  | 'ZERO'
  | 'UNIT_MISMATCH'

export type ParsedWeight =
  | {
      ok: true
      weight: number
      text: string
      unit: string
      /** false when the unit glyph was not read — the operator must see the display unit themselves. */
      unitDetected: boolean
    }
  | { ok: false; reason: WeightParseFailure; message: string }

export type WeightParseOptions = {
  unit?: string
  resolution?: number | null
  capacity?: number | null
}

const KNOWN_UNITS = ['g', 'kg', 'mg', 'ct', 'oz', 'ozt', 'lb', 'dwt', 'gn', 'tl', 'mom', 'pcs', '%']

const MESSAGES: Record<WeightParseFailure, string> = {
  NO_READING: 'No weight found in the box',
  INVALID_CHARACTERS: 'Display text contains unexpected characters',
  WRONG_FORMAT: 'Reading does not match the scale display format',
  AMBIGUOUS: 'More than one number in the box — frame only the weight display',
  NEGATIVE: 'Negative weight — re-zero the scale',
  ZERO: 'Scale shows zero — place the item on the pan',
  UNIT_MISMATCH: 'Display unit does not match the scale unit',
}

function fail(reason: WeightParseFailure): ParsedWeight {
  return { ok: false, reason, message: MESSAGES[reason] }
}

function normalizeText(raw: string) {
  return String(raw || '')
    .normalize('NFKC')
    .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
    .replace(/(^|\s)-+\s+(?=\d)/g, '$1-')
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
}

/** Strip decoration around a token (brackets, stars, arrows) but keep sign, digits, letters and the point. */
function trimDecoration(token: string) {
  return token.replace(/^[^0-9A-Za-z.\-%]+/, '').replace(/[^0-9A-Za-z.%]+$/, '')
}

type Candidate = { text: string; negative: boolean; unit: string | null }

/**
 * Strictly parse a scale display reading. Accepts only a plain decimal number with exactly the
 * number of decimals the scale resolution implies (0.01 g → "1250.35"), optionally followed by
 * the unit. Any token that mixes digits with other letters (1250.3B, ABC1250, GJ-2000, SN12345)
 * is never a weight candidate; if nothing else is present the reading is rejected.
 */
export function parseScaleWeight(rawText: string, options: WeightParseOptions = {}): ParsedWeight {
  const expectedUnit = String(options.unit || 'g').toLowerCase()
  const decimals = decimalsForResolution(options.resolution ?? null)
  const hardMax = options.capacity && options.capacity > 0 ? options.capacity * 1.1 : null
  const maxIntDigits = hardMax ? String(Math.floor(hardMax)).length : 6

  const text = normalizeText(rawText)
  if (!text.trim()) return fail('NO_READING')

  const candidates: Candidate[] = []
  let contaminated = false
  let wrongFormat = false
  let unitSeen: string | null = null
  let otherUnit = false

  const tokens = text.split(/\s+/).map(trimDecoration).filter(Boolean)
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const lower = token.toLowerCase()
    if (!/\d/.test(token)) {
      if (lower === expectedUnit) unitSeen = expectedUnit
      else if (KNOWN_UNITS.includes(lower)) otherUnit = true
      continue
    }

    const match = /^(-?)(\d+(?:\.\d+)?)([a-z%]*)$/i.exec(token)
    if (!match) {
      contaminated = true
      continue
    }
    const [, sign, number, suffixRaw] = match
    const suffix = suffixRaw.toLowerCase()
    if (suffix && suffix !== expectedUnit) {
      if (KNOWN_UNITS.includes(suffix)) otherUnit = true
      else contaminated = true
      continue
    }

    const [intPart, fracPart = ''] = number.split('.')
    const formatOk =
      (decimals == null ? true : fracPart.length === decimals)
      && intPart.length <= maxIntDigits
      && !(intPart.length > 1 && intPart.startsWith('0'))
    if (!formatOk) {
      wrongFormat = true
      continue
    }

    let unit: string | null = suffix || null
    if (!unit && tokens[i + 1]?.toLowerCase() === expectedUnit) unit = expectedUnit
    if (unit) unitSeen = unit
    candidates.push({ text: number, negative: sign === '-', unit })
  }

  if (candidates.length > 1) return fail('AMBIGUOUS')
  if (candidates.length === 0) {
    if (otherUnit) return fail('UNIT_MISMATCH')
    if (contaminated) return fail('INVALID_CHARACTERS')
    if (wrongFormat) return fail('WRONG_FORMAT')
    return fail('NO_READING')
  }
  if (otherUnit) return fail('UNIT_MISMATCH')

  const [candidate] = candidates
  if (candidate.negative) return fail('NEGATIVE')
  const value = Number(candidate.text)
  if (!Number.isFinite(value)) return fail('WRONG_FORMAT')
  if (value === 0) return fail('ZERO')

  const factor = 10 ** (decimals ?? 6)
  return {
    ok: true,
    weight: Math.round(value * factor) / factor,
    text: candidate.text,
    unit: expectedUnit,
    unitDetected: unitSeen === expectedUnit,
  }
}

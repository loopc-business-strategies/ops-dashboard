import { checkWeightAgainstScale, type ScaleWeighProfile } from './cameraSettings'
import type { SevenSegmentResult } from './sevenSegment'
import { parseScaleWeight, type ParsedWeight, type WeightParseFailure } from './weightParser'

type MlSymbol = { text: string; confidence: number }
type MlElement = { text: string; confidence: number; symbols?: MlSymbol[] }
type MlLine = { text: string; confidence: number; elements?: MlElement[] }
export type MlReading = { text: string; lines: MlLine[] }

export type FrameStatus =
  | 'OK'
  | 'REVIEW'
  | 'NO_READING'
  | 'INVALID'
  | 'LOW_CONFIDENCE'
  | 'ENGINES_DISAGREE'
  | 'OUT_OF_RANGE'
  | 'ZERO'
  | 'CLIPPED'
  | 'UNIT_MISMATCH'

export type FrameReading = {
  status: FrameStatus
  /** Weight fed to the stability tracker; null when this frame must break a stable run. */
  weight: number | null
  /** Best-effort value to show the operator (may be unconfirmable). */
  displayWeight: number | null
  confidence: number
  unitDetected: boolean
  crossCheckAgreed: boolean | null
  mlText: string
  sevenText: string | null
  message: string
}

export const LOW_CONFIDENCE_GUIDANCE = 'Move closer / improve lighting / keep display inside the box.'

const FAILURE_STATUS: Record<WeightParseFailure, FrameStatus> = {
  NO_READING: 'NO_READING',
  INVALID_CHARACTERS: 'INVALID',
  WRONG_FORMAT: 'INVALID',
  AMBIGUOUS: 'INVALID',
  NEGATIVE: 'INVALID',
  ZERO: 'ZERO',
  UNIT_MISMATCH: 'UNIT_MISMATCH',
}

function cleanToken(text: string) {
  return String(text || '').normalize('NFKC').replace(/\s+/g, '')
}

/** ML Kit confidence for the token that produced the parsed weight (lowest symbol → element → line). */
export function mlTokenConfidence(ml: MlReading, weightText: string): number {
  let best: number | null = null
  for (const line of ml.lines || []) {
    for (const element of line.elements || []) {
      if (!cleanToken(element.text).includes(weightText)) continue
      const digitSymbols = (element.symbols || []).filter((s) => /[0-9.]/.test(s.text))
      const conf = digitSymbols.length
        ? Math.min(...digitSymbols.map((s) => Number(s.confidence) || 0))
        : Number(element.confidence) || 0
      best = best == null ? conf : Math.max(best, conf)
    }
  }
  if (best != null) return clamp01(best)
  const lines = (ml.lines || []).filter((l) => cleanToken(l.text).includes(weightText))
  if (!lines.length) return 0
  return clamp01(Math.max(...lines.map((l) => Number(l.confidence) || 0)))
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
}

function failureReading(
  status: FrameStatus,
  message: string,
  mlText: string,
  sevenText: string | null,
  displayWeight: number | null = null,
): FrameReading {
  return {
    status,
    weight: null,
    displayWeight,
    confidence: 0,
    unitDetected: false,
    crossCheckAgreed: null,
    mlText,
    sevenText,
    message,
  }
}

/**
 * Combine ML Kit text and the seven-segment decode into one frame reading.
 * Agreement between the two engines is what earns a confirmable confidence; disagreement caps
 * confidence at 0.5 and a single-engine reading is halved, so neither can pass the ≥ 0.6 minimum.
 */
export function combineOcrReadings(input: {
  ml: MlReading | null
  seven: SevenSegmentResult | null
  profile: ScaleWeighProfile
}): FrameReading {
  const { ml, seven, profile } = input
  const settings = profile.cameraOcr
  const parseOpts = { unit: profile.unit, resolution: profile.resolution, capacity: profile.capacity }
  const mlText = (ml?.text || '').trim()
  const sevenText = seven?.text ?? null

  const mlParsed: ParsedWeight = ml ? parseScaleWeight(mlText, parseOpts) : { ok: false, reason: 'NO_READING', message: '' }
  const useSeven = settings.sevenSegmentCrossCheck
  const sevenParsed: ParsedWeight | null = useSeven
    ? sevenText
      ? parseScaleWeight(sevenText, parseOpts)
      : { ok: false, reason: 'NO_READING', message: '' }
    : null

  const mlConf = mlParsed.ok && ml ? mlTokenConfidence(ml, mlParsed.text) : 0
  const sevenConf = sevenParsed?.ok ? clamp01(seven?.confidence ?? 0) : 0
  const tolerance = (profile.resolution || 0.01) / 2

  let weight: number | null = null
  let confidence = 0
  let crossCheckAgreed: boolean | null = null
  const unitDetected = mlParsed.ok ? mlParsed.unitDetected : false

  if (!useSeven) {
    if (!mlParsed.ok) {
      return failureReading(FAILURE_STATUS[mlParsed.reason], mlParsed.message, mlText, sevenText)
    }
    weight = mlParsed.weight
    confidence = mlConf
  } else if (mlParsed.ok && sevenParsed?.ok) {
    if (Math.abs(mlParsed.weight - sevenParsed.weight) <= tolerance) {
      weight = mlParsed.weight
      confidence = Math.max(mlConf, sevenConf)
      crossCheckAgreed = true
    } else {
      return {
        ...failureReading(
          'ENGINES_DISAGREE',
          `Readings disagree (${mlParsed.text} vs ${sevenParsed.text}). ${LOW_CONFIDENCE_GUIDANCE}`,
          mlText,
          sevenText,
          mlParsed.weight,
        ),
        confidence: Math.min(0.5, Math.max(mlConf, sevenConf)),
        crossCheckAgreed: false,
      }
    }
  } else if (mlParsed.ok || sevenParsed?.ok) {
    const single = (mlParsed.ok ? mlParsed : sevenParsed) as Extract<ParsedWeight, { ok: true }>
    weight = single.weight
    confidence = 0.5 * (mlParsed.ok ? mlConf : sevenConf)
    crossCheckAgreed = false
  } else {
    if (seven?.reason === 'CLIPPED') {
      return failureReading('CLIPPED', 'Digits cut off — keep the whole display inside the box', mlText, sevenText)
    }
    const failed = [mlParsed, sevenParsed].filter((p): p is Extract<ParsedWeight, { ok: false }> => !!p && !p.ok)
    const priority: WeightParseFailure[] = ['ZERO', 'UNIT_MISMATCH', 'NEGATIVE', 'AMBIGUOUS', 'INVALID_CHARACTERS', 'WRONG_FORMAT']
    const reason = priority.find((r) => failed.some((f) => f.reason === r)) || 'NO_READING'
    const message = failed.find((f) => f.reason === reason)?.message || 'No weight found in the box'
    return failureReading(FAILURE_STATUS[reason], message, mlText, sevenText)
  }

  const base: FrameReading = {
    status: 'OK',
    weight,
    displayWeight: weight,
    confidence,
    unitDetected,
    crossCheckAgreed,
    mlText,
    sevenText,
    message: '',
  }

  if (confidence < settings.minConfidence) {
    return { ...base, status: 'LOW_CONFIDENCE', message: LOW_CONFIDENCE_GUIDANCE }
  }

  const capacity = checkWeightAgainstScale(weight, profile)
  if (capacity.status === 'OUT_OF_RANGE') {
    return { ...base, status: 'OUT_OF_RANGE', weight: null, message: capacity.message }
  }
  if (capacity.status === 'INVALID') {
    return { ...base, status: 'INVALID', weight: null, message: capacity.message }
  }
  if (capacity.status === 'REVIEW') {
    return { ...base, status: 'REVIEW', message: capacity.message }
  }
  return base
}

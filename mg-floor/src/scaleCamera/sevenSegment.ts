import {
  binarize,
  type Component,
  connectedComponents,
  fillRatio,
  medianFilter3,
  otsuThreshold,
} from './imagePixels'

export type SevenSegmentDigit = {
  char: string
  confidence: number
  x0: number
  x1: number
  /** Lit share of each segment zone a–g; absent for narrow glyphs read as '1'. */
  fills?: number[]
}

export type SevenSegmentOptions = { segmentThreshold?: number }

export type SevenSegmentFailure = 'NO_DIGITS' | 'CLIPPED' | 'UNKNOWN_DIGIT'

export type SevenSegmentResult = {
  /** Decoded display text (e.g. "1250.35"); null when any glyph could not be decoded. */
  text: string | null
  /** Lowest per-glyph confidence (0..1). */
  confidence: number
  digits: SevenSegmentDigit[]
  reason?: SevenSegmentFailure
}

/**
 * Segment bit order: a b c d e f g. No entry for '1' (b+c): a real 1 is a narrow glyph handled by width,
 * so a wide glyph with only b+c lit is a digit whose other segments were missed.
 */
const DIGIT_PATTERNS: Record<string, string> = {
  '1111110': '0',
  '1101101': '2',
  '1111001': '3',
  '0110011': '4',
  '1011011': '5',
  '1011111': '6',
  '0011111': '6',
  '1110000': '7',
  '1110010': '7',
  '1111111': '8',
  '1111011': '9',
  '1110011': '9',
}

/** Sampling zones [x0, y0, x1, y1] normalized to the digit box. */
const SEGMENT_ZONES: [number, number, number, number][] = [
  [0.28, 0.0, 0.72, 0.14], // a
  [0.72, 0.16, 1.0, 0.42], // b
  [0.72, 0.58, 1.0, 0.84], // c
  [0.28, 0.86, 0.72, 1.0], // d
  [0.0, 0.58, 0.28, 0.84], // e
  [0.0, 0.16, 0.28, 0.42], // f
  [0.28, 0.43, 0.72, 0.57], // g
]

export const DEFAULT_SEGMENT_THRESHOLD = 0.3
const SEGMENT_MARGIN = 0.2

type Box = { x0: number; y0: number; x1: number; y1: number; comps: Component[] }

const boxW = (b: { x0: number; x1: number }) => b.x1 - b.x0 + 1
const boxH = (b: { y0: number; y1: number }) => b.y1 - b.y0 + 1

function median(values: number[]) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function mergeBoxes(a: Box, b: Box): Box {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    comps: [...a.comps, ...b.comps],
  }
}

function groupByColumns(comps: Component[]): Box[] {
  const sorted = [...comps].sort((a, b) => a.x0 - b.x0)
  const groups: Box[] = []
  for (const c of sorted) {
    const last = groups[groups.length - 1]
    if (last && c.x0 <= last.x1 + 1) {
      groups[groups.length - 1] = mergeBoxes(last, { ...c, comps: [c] })
    } else {
      groups.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, comps: [c] })
    }
  }
  return groups
}

/** Join column groups belonging to one digit (segments separated by small gaps). */
function joinDigitParts(groups: Box[], digitH: number): Box[] {
  const out: Box[] = []
  for (const g of groups) {
    const last = out[out.length - 1]
    if (last) {
      const gap = g.x0 - last.x1 - 1
      const merged = mergeBoxes(last, g)
      if (gap <= digitH * 0.12 && boxW(merged) <= digitH * 0.75) {
        out[out.length - 1] = merged
        continue
      }
    }
    out.push(g)
  }
  return out
}

function segmentConfidence(fill: number, threshold: number) {
  return Math.min(1, Math.abs(fill - threshold) / SEGMENT_MARGIN)
}

/**
 * Decode a seven-segment display from a cropped grayscale image (1 byte per pixel).
 * Glyphs shorter than 60% of the digit height (unit "g", stability/zero indicators) are ignored;
 * a small blob on the baseline between two digits is the decimal point.
 */
export function decodeSevenSegment(
  gray: Uint8Array,
  width: number,
  height: number,
  options: SevenSegmentOptions = {},
): SevenSegmentResult {
  const threshold = options.segmentThreshold ?? DEFAULT_SEGMENT_THRESHOLD
  const none = (reason: SevenSegmentFailure): SevenSegmentResult => ({ text: null, confidence: 0, digits: [], reason })
  if (width < 8 || height < 8 || gray.length < width * height) return none('NO_DIGITS')

  const filtered = medianFilter3(gray, width, height)
  const { mask } = binarize(filtered, width, height, otsuThreshold(filtered))
  let foreground = 0
  for (let i = 0; i < mask.length; i += 1) foreground += mask[i]
  // Lit segments cover a small share of a display; ~half means the threshold split noise or glare.
  if (foreground < mask.length * 0.01 || foreground > mask.length * 0.45) return none('NO_DIGITS')
  const minArea = Math.max(4, Math.round(width * height * 0.00005))
  const comps = connectedComponents(mask, width, height, minArea).filter(
    (c) => !(boxW(c) > width * 0.6 && boxH(c) > height * 0.6) && c.area < width * height * 0.4,
  )
  if (!comps.length) return none('NO_DIGITS')

  const maxCompH = Math.max(...comps.map(boxH))
  const isDotLike = (c: Component) => {
    const w = boxW(c)
    const h = boxH(c)
    return Math.max(w, h) <= maxCompH * 0.4 && w / h >= 0.5 && w / h <= 2
  }
  const dots = comps.filter(isDotLike)
  const parts = comps.filter((c) => !isDotLike(c))
  if (!parts.length) return none('NO_DIGITS')

  const columns = groupByColumns(parts)
  const digitH0 = Math.max(...columns.map(boxH))
  const groups = joinDigitParts(columns, digitH0)
  const digitH = Math.max(...groups.map(boxH))
  const digitGroups = groups.filter((g) => boxH(g) >= digitH * 0.6)
  if (!digitGroups.length) return none('NO_DIGITS')

  const clipped = groups.some(
    (g) => boxH(g) >= digitH * 0.25 && g.comps.some((c) => c.touchesLeft || c.touchesRight),
  ) || digitGroups.some((g) => g.comps.some((c) => c.touchesTop || c.touchesBottom))
  if (clipped) return none('CLIPPED')

  const top = median(digitGroups.map((g) => g.y0))
  const bottom = median(digitGroups.map((g) => g.y1))
  const bandH = Math.max(1, bottom - top + 1)

  // A digit lying entirely outside the box is invisible; requiring clear space on both sides
  // makes the operator frame the whole display rather than risk a dropped leading digit.
  const edgeMargin = bandH * 0.15
  if (digitGroups[0].x0 < edgeMargin || digitGroups[digitGroups.length - 1].x1 > width - 1 - edgeMargin) {
    return none('CLIPPED')
  }
  const wide = digitGroups.map(boxW).filter((w) => w >= bandH * 0.35)
  const refW = wide.length ? median(wide) : bandH * 0.55

  const digits: SevenSegmentDigit[] = digitGroups.map((g) => {
    const w = boxW(g)
    if (w < refW * 0.45) {
      const tallEnough = boxH(g) >= bandH * 0.6
      const ratio = w / refW
      return {
        char: tallEnough ? '1' : '?',
        confidence: tallEnough ? Math.min(1, Math.max(0.3, (0.45 - ratio) / 0.15)) : 0,
        x0: g.x0,
        x1: g.x1,
      }
    }
    let bits = ''
    let confidence = 1
    const fills: number[] = []
    for (const [zx0, zy0, zx1, zy1] of SEGMENT_ZONES) {
      const fill = fillRatio(
        mask,
        width,
        height,
        g.x0 + zx0 * w,
        top + zy0 * bandH,
        g.x0 + zx1 * w,
        top + zy1 * bandH,
      )
      fills.push(fill)
      bits += fill >= threshold ? '1' : '0'
      confidence = Math.min(confidence, segmentConfidence(fill, threshold))
    }
    const char = DIGIT_PATTERNS[bits]
    return { char: char ?? '?', confidence: char ? confidence : 0, x0: g.x0, x1: g.x1, fills }
  })

  if (digits.some((d) => d.char === '?')) {
    return { text: null, confidence: 0, digits, reason: 'UNKNOWN_DIGIT' }
  }

  const minus = groups.some((g) => {
    const w = boxW(g)
    const h = boxH(g)
    const cy = (g.y0 + g.y1) / 2
    return h < bandH * 0.3 && w / h >= 2 && cy > top + bandH * 0.35 && cy < top + bandH * 0.65 && g.x1 < digits[0].x0
  })

  const pointAfter = new Set<number>()
  for (const dot of dots) {
    const cx = (dot.x0 + dot.x1) / 2
    const cy = (dot.y0 + dot.y1) / 2
    if (cy < top + bandH * 0.75 || dot.y1 > bottom + bandH * 0.1) continue
    for (let i = 0; i < digits.length - 1; i += 1) {
      if (cx > digits[i].x1 - bandH * 0.05 && cx < digits[i + 1].x0 + bandH * 0.05) {
        pointAfter.add(i)
        break
      }
    }
  }

  let text = minus ? '-' : ''
  digits.forEach((d, i) => {
    text += d.char
    if (pointAfter.has(i)) text += '.'
  })

  return {
    text,
    confidence: Math.min(...digits.map((d) => d.confidence)),
    digits,
  }
}

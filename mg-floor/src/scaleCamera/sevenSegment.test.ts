import { describe, expect, it } from 'vitest'
import { RENDER_MARGIN as MARGIN, renderSevenSegment as render } from './__testutils__/renderSevenSegment'
import { base64ToBytes, bytesToBase64 } from './imagePixels'
import { decodeSevenSegment } from './sevenSegment'

describe('decodeSevenSegment', () => {
  it.each(['1250.35', '100.00', '999.99', '2200.00', '0.01', '1500.25', '12.50', '8888.88', '4567.89'])(
    'decodes %s',
    (display) => {
      const { px, width, height } = render(display)
      const r = decodeSevenSegment(px, width, height)
      expect(r.text).toBe(display)
      expect(r.confidence).toBeGreaterThan(0.8)
    },
  )

  it('handles light digits on a dark background', () => {
    const { px, width, height } = render('1250.35', { dark: false })
    expect(decodeSevenSegment(px, width, height).text).toBe('1250.35')
  })

  it('detects a leading minus sign', () => {
    const { px, width, height } = render('12.50', { minus: true })
    expect(decodeSevenSegment(px, width, height).text).toBe('-12.50')
  })

  it('reports clipped digits instead of dropping them', () => {
    const { px, width, height } = render('2200.00', { offsetX: -MARGIN - 3, unitGlyph: false })
    const r = decodeSevenSegment(px, width, height)
    expect(r.text).toBeNull()
    expect(r.reason).toBe('CLIPPED')
  })

  it('treats digits hugging the crop edge as clipped', () => {
    const { px, width, height } = render('2200.00', { offsetX: -MARGIN + 4, unitGlyph: false })
    expect(decodeSevenSegment(px, width, height).reason).toBe('CLIPPED')
  })

  it('refuses unknown segment patterns', () => {
    const { px, width, height } = render('12?0.35')
    const r = decodeSevenSegment(px, width, height)
    expect(r.text).toBeNull()
    expect(r.reason).toBe('UNKNOWN_DIGIT')
  })

  it('returns NO_DIGITS for a blank display', () => {
    const { px, width, height } = render('', { unitGlyph: false })
    expect(decodeSevenSegment(px, width, height).reason).toBe('NO_DIGITS')
  })

  it('reports per-segment fills for diagnostics', () => {
    const { px, width, height } = render('8888.88')
    const r = decodeSevenSegment(px, width, height)
    expect(r.digits).toHaveLength(6)
    for (const d of r.digits) {
      expect(d.fills).toHaveLength(7)
      for (const f of d.fills ?? []) expect(f).toBeGreaterThan(0.5)
    }
    const lead = render('1250.35')
    const one = decodeSevenSegment(lead.px, lead.width, lead.height)
    expect(one.digits[0].char).toBe('1')
    expect(one.digits[0].fills).toBeUndefined()
  })

  it('applies the configured segment threshold', () => {
    const { px, width, height } = render('1250.35')
    expect(decodeSevenSegment(px, width, height, { segmentThreshold: 0.45 }).text).toBe('1250.35')
    // Nothing reaches an impossible threshold, so every wide glyph becomes unknown.
    const r = decodeSevenSegment(px, width, height, { segmentThreshold: 1.01 })
    expect(r.text).toBeNull()
    expect(r.reason).toBe('UNKNOWN_DIGIT')
  })

  it('never reads a wide glyph with missed segments as 1', () => {
    // At 0.6 the thin horizontal segments of the 3 fall below threshold, leaving only b+c lit.
    const { px, width, height } = render('1250.35')
    const r = decodeSevenSegment(px, width, height, { segmentThreshold: 0.6 })
    expect(r.text).not.toBe('1250.15')
    expect(r.text).toBeNull()
    expect(r.reason).toBe('UNKNOWN_DIGIT')
  })
})

describe('base64 helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 128])
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
    expect(Array.from(base64ToBytes(bytesToBase64(bytes.slice(0, 8))))).toEqual(Array.from(bytes.slice(0, 8)))
  })
})

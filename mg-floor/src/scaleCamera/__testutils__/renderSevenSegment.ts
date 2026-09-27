/** Synthetic seven-segment LCD renderer for decoder and replay tests (grayscale, 1 byte per pixel). */

const H = 60
const W = 33
const PITCH = W + 14
export const RENDER_MARGIN = 20

/** Segment rectangles [x0, y0, x1, y1) inside a digit cell. */
const SEGMENTS: Record<string, [number, number, number, number]> = {
  a: [9, 0, 24, 7],
  b: [26, 9, 33, 28],
  c: [26, 32, 33, 51],
  d: [9, 53, 24, 60],
  e: [0, 32, 7, 51],
  f: [0, 9, 7, 28],
  g: [9, 27, 24, 34],
}

const GLYPHS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '?': 'adg',
}

export type RenderOptions = { dark?: boolean; noise?: number; offsetX?: number; unitGlyph?: boolean; minus?: boolean }

export function renderSevenSegment(display: string, opts: RenderOptions = {}) {
  const { dark = true, noise = 12, offsetX = 0, unitGlyph = true, minus = false } = opts
  const digits = display.replace('.', '')
  const pointAfter = display.indexOf('.') - 1
  const width = RENDER_MARGIN * 2 + digits.length * PITCH + (unitGlyph ? 30 : 0) + (minus ? 30 : 0)
  const height = H + RENDER_MARGIN * 2
  const bg = dark ? 205 : 30
  const fg = dark ? 45 : 220
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const px = new Uint8Array(width * height)
  for (let i = 0; i < px.length; i += 1) px[i] = Math.max(0, Math.min(255, bg + (rand() - 0.5) * 2 * noise))
  const fill = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y += 1) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x += 1) {
        px[y * width + x] = Math.max(0, Math.min(255, fg + (rand() - 0.5) * 2 * noise))
      }
    }
  }
  let cursor = RENDER_MARGIN + offsetX
  if (minus) {
    fill(cursor, RENDER_MARGIN + 27, cursor + 20, RENDER_MARGIN + 34)
    cursor += 30
  }
  for (let i = 0; i < digits.length; i += 1) {
    for (const seg of GLYPHS[digits[i]]) {
      const [x0, y0, x1, y1] = SEGMENTS[seg]
      fill(cursor + x0, RENDER_MARGIN + y0, cursor + x1, RENDER_MARGIN + y1)
    }
    if (i === pointAfter) fill(cursor + W + 4, RENDER_MARGIN + H - 6, cursor + W + 10, RENDER_MARGIN + H)
    cursor += PITCH
  }
  if (unitGlyph) {
    const gx = cursor - 2
    fill(gx, RENDER_MARGIN + 36, gx + 14, RENDER_MARGIN + 40)
    fill(gx, RENDER_MARGIN + 36, gx + 3, RENDER_MARGIN + 50)
    fill(gx + 11, RENDER_MARGIN + 36, gx + 14, RENDER_MARGIN + 58)
    fill(gx, RENDER_MARGIN + 48, gx + 14, RENDER_MARGIN + 51)
  }
  return { px, width, height }
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64_ALPHABET.length; i += 1) table[B64_ALPHABET.charCodeAt(i)] = i
  table['-'.charCodeAt(0)] = 62
  table['_'.charCodeAt(0)] = 63
  return table
})()

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/_-]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buffer = 0
  let bits = 0
  let o = 0
  for (let i = 0; i < clean.length; i += 1) {
    const v = B64_LOOKUP[clean.charCodeAt(i)]
    if (v < 0) continue
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[o] = (buffer >> bits) & 0xff
      o += 1
    }
  }
  return o === out.length ? out : out.slice(0, o)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    const n = (b0 << 16) | (b1 << 8) | b2
    out += B64_ALPHABET[(n >> 18) & 63] + B64_ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64_ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64_ALPHABET[n & 63] : '='
  }
  return out
}

/** 3×3 median filter (edges copied) — removes sensor speckle without eroding thin segments. */
export function medianFilter3(src: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(src)
  const win = new Uint8Array(9)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let k = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        const row = (y + dy) * width
        for (let dx = -1; dx <= 1; dx += 1) win[k++] = src[row + x + dx]
      }
      for (let i = 1; i < 9; i += 1) {
        const v = win[i]
        let j = i - 1
        while (j >= 0 && win[j] > v) {
          win[j + 1] = win[j]
          j -= 1
        }
        win[j + 1] = v
      }
      out[y * width + x] = win[4]
    }
  }
  return out
}

export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i += 1) hist[gray[i]] += 1
  const total = gray.length
  let sumAll = 0
  for (let v = 0; v < 256; v += 1) sumAll += v * hist[v]
  let sumB = 0
  let weightB = 0
  let best = 0
  let threshold = 127
  for (let v = 0; v < 256; v += 1) {
    weightB += hist[v]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break
    sumB += v * hist[v]
    const meanB = sumB / weightB
    const meanF = (sumAll - sumB) / weightF
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (between > best) {
      best = between
      threshold = v
    }
  }
  return threshold
}

/**
 * Binarize so that 1 = display glyph. Polarity is taken from the image border, which is
 * display background when the guide box frames the display (dark LCD digits or lit LED digits).
 */
export function binarize(gray: Uint8Array, width: number, height: number, threshold: number) {
  let borderDark = 0
  let borderTotal = 0
  const count = (i: number) => {
    borderTotal += 1
    if (gray[i] <= threshold) borderDark += 1
  }
  for (let x = 0; x < width; x += 1) {
    count(x)
    count((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    count(y * width)
    count(y * width + width - 1)
  }
  const darkForeground = borderDark <= borderTotal / 2
  const mask = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i += 1) {
    const dark = gray[i] <= threshold
    mask[i] = dark === darkForeground ? 1 : 0
  }
  return { mask, darkForeground }
}

export type Component = {
  x0: number
  y0: number
  x1: number
  y1: number
  area: number
  touchesLeft: boolean
  touchesRight: boolean
  touchesTop: boolean
  touchesBottom: boolean
}

/** 8-connected components of a binary mask (x1/y1 inclusive). */
export function connectedComponents(mask: Uint8Array, width: number, height: number, minArea = 1): Component[] {
  const labels = new Int32Array(mask.length)
  const stack = new Int32Array(mask.length)
  const comps: Component[] = []
  let next = 1
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || labels[start]) continue
    let sp = 0
    stack[sp++] = start
    labels[start] = next
    let x0 = width
    let y0 = height
    let x1 = -1
    let y1 = -1
    let area = 0
    while (sp > 0) {
      const idx = stack[--sp]
      const x = idx % width
      const y = (idx - x) / width
      area += 1
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const n = ny * width + nx
          if (mask[n] && !labels[n]) {
            labels[n] = next
            stack[sp++] = n
          }
        }
      }
    }
    next += 1
    if (area >= minArea) {
      comps.push({
        x0,
        y0,
        x1,
        y1,
        area,
        touchesLeft: x0 === 0,
        touchesRight: x1 === width - 1,
        touchesTop: y0 === 0,
        touchesBottom: y1 === height - 1,
      })
    }
  }
  return comps
}

/** Fraction of mask pixels set inside [x0,x1)×[y0,y1). */
export function fillRatio(
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const ax = Math.min(width - 1, Math.max(0, Math.floor(x0)))
  const ay = Math.min(height - 1, Math.max(0, Math.floor(y0)))
  const bx = Math.min(width, Math.max(ax + 1, Math.ceil(x1)))
  const by = Math.min(height, Math.max(ay + 1, Math.ceil(y1)))
  let on = 0
  let total = 0
  for (let y = ay; y < by; y += 1) {
    const row = y * width
    for (let x = ax; x < bx; x += 1) {
      total += 1
      on += mask[row + x]
    }
  }
  return total ? on / total : 0
}

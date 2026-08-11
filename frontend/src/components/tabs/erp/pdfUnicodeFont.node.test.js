import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ensurePdfUnicodeFonts,
  PDF_FALLBACK_FONT_FAMILY,
  PDF_UNICODE_FONT_FAMILY,
  resetPdfUnicodeFontCache,
} from './pdfUnicodeFont'

describe('ensurePdfUnicodeFonts', () => {
  beforeEach(() => {
    resetPdfUnicodeFontCache()
    vi.unstubAllGlobals()
    if (typeof globalThis.btoa !== 'function') {
      vi.stubGlobal('btoa', (value) => Buffer.from(String(value), 'binary').toString('base64'))
    }
  })

  test('registers NotoSans regular and bold on jsPDF doc', async () => {
    const fakeTtf = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => fakeTtf,
    })))

    const doc = {
      addFileToVFS: vi.fn(),
      addFont: vi.fn(),
      setFont: vi.fn(),
    }

    const family = await ensurePdfUnicodeFonts(doc)
    expect(family).toBe(PDF_UNICODE_FONT_FAMILY)
    expect(doc.addFileToVFS).toHaveBeenCalledWith('NotoSans-Regular.ttf', expect.any(String))
    expect(doc.addFileToVFS).toHaveBeenCalledWith('NotoSans-Bold.ttf', expect.any(String))
    expect(doc.addFont).toHaveBeenCalledWith('NotoSans-Regular.ttf', 'NotoSans', 'normal')
    expect(doc.addFont).toHaveBeenCalledWith('NotoSans-Bold.ttf', 'NotoSans', 'bold')
    expect(doc.setFont).toHaveBeenCalledWith('NotoSans', 'normal')
  })

  test('falls back to helvetica when font fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
    })))

    const doc = {
      addFileToVFS: vi.fn(),
      addFont: vi.fn(),
      setFont: vi.fn(),
    }

    const family = await ensurePdfUnicodeFonts(doc)
    expect(family).toBe(PDF_FALLBACK_FONT_FAMILY)
    expect(doc.addFont).not.toHaveBeenCalled()
  })
})

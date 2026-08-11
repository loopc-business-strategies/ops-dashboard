export const PDF_UNICODE_FONT_FAMILY = 'NotoSans'
export const PDF_FALLBACK_FONT_FAMILY = 'helvetica'

const FONT_FILES = {
  normal: {
    vfsName: 'NotoSans-Regular.ttf',
    url: '/fonts/NotoSans-Regular.ttf',
    style: 'normal',
  },
  bold: {
    vfsName: 'NotoSans-Bold.ttf',
    url: '/fonts/NotoSans-Bold.ttf',
    style: 'bold',
  },
}

const fontBase64Cache = {
  normal: null,
  bold: null,
}

async function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64')
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function loadFontBase64(styleKey) {
  if (fontBase64Cache[styleKey]) return fontBase64Cache[styleKey]
  const meta = FONT_FILES[styleKey]
  if (!meta) return null
  const response = await fetch(meta.url)
  if (!response.ok) {
    throw new Error(`Failed to load PDF font ${meta.url} (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  const base64 = await arrayBufferToBase64(buffer)
  fontBase64Cache[styleKey] = base64
  return base64
}

/**
 * Register Noto Sans (Latin + Cyrillic) on a jsPDF document.
 * Returns the font family to use; falls back to Helvetica if fonts cannot load.
 */
export async function ensurePdfUnicodeFonts(doc) {
  if (!doc?.addFileToVFS || !doc?.addFont || !doc?.setFont) {
    return PDF_FALLBACK_FONT_FAMILY
  }

  try {
    const [regular, bold] = await Promise.all([
      loadFontBase64('normal'),
      loadFontBase64('bold'),
    ])
    if (!regular || !bold) return PDF_FALLBACK_FONT_FAMILY

    doc.addFileToVFS(FONT_FILES.normal.vfsName, regular)
    doc.addFont(FONT_FILES.normal.vfsName, PDF_UNICODE_FONT_FAMILY, 'normal')
    doc.addFileToVFS(FONT_FILES.bold.vfsName, bold)
    doc.addFont(FONT_FILES.bold.vfsName, PDF_UNICODE_FONT_FAMILY, 'bold')
    // jsPDF italic requests: map to regular NotoSans (no italic TTF shipped).
    doc.addFont(FONT_FILES.normal.vfsName, PDF_UNICODE_FONT_FAMILY, 'italic')
    doc.addFont(FONT_FILES.bold.vfsName, PDF_UNICODE_FONT_FAMILY, 'bolditalic')
    doc.setFont(PDF_UNICODE_FONT_FAMILY, 'normal')
    return PDF_UNICODE_FONT_FAMILY
  } catch {
    return PDF_FALLBACK_FONT_FAMILY
  }
}

/** Test helper — clear cached font bytes between unit tests. */
export function resetPdfUnicodeFontCache() {
  fontBase64Cache.normal = null
  fontBase64Cache.bold = null
}

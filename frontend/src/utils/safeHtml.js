/** Escape text for safe HTML interpolation (print windows, titles). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Allow only safe logo sources for print/export img src.
 * Blocks javascript:, vbscript:, and other non-http(s)/data schemes.
 */
export function sanitizeLogoUrl(rawUrl) {
  const url = String(rawUrl || '').trim()
  if (!url) return ''

  if (url.startsWith('data:image/')) {
    const match = url.match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i)
    if (match) return url
    return ''
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost')
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href
    }
  } catch {
    return ''
  }

  return ''
}

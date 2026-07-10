import { useEffect, useState } from 'react'
import { createLogoRenderAsset } from '../erp/ERPBrandingUtils'
import { sanitizeLogoUrl } from '../../../utils/safeHtml'

/**
 * Resolve logo src for voucher document preview vs print/PDF.
 * Preview uses the original URL; print rasterizes at 2x for sharper output.
 */
export function useDocumentPrintLogo(logoUrl, width, height, fit = 'contain', screenPreview = true) {
  const safePreviewUrl = sanitizeLogoUrl(logoUrl) || ''
  const [src, setSrc] = useState(safePreviewUrl)

  useEffect(() => {
    if (!logoUrl) {
      setSrc('')
      return undefined
    }

    if (screenPreview) {
      setSrc(safePreviewUrl)
      return undefined
    }

    let cancelled = false
    createLogoRenderAsset(logoUrl, width, height, fit, { renderScale: 2 })
      .then((asset) => {
        if (!cancelled) setSrc(asset || safePreviewUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(safePreviewUrl)
      })

    return () => {
      cancelled = true
    }
  }, [logoUrl, width, height, fit, screenPreview, safePreviewUrl])

  return src
}

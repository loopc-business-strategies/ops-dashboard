import { escapeHtml } from '../../../utils/safeHtml'
import {
  DEFAULT_BRANDING,
  clampBrandingDimension,
  createLogoRenderAsset,
} from './ERPBrandingUtils'

export async function buildBrandingLogoTag(brandingConfig, extraStyle = '') {
  const logoAsset = await createLogoRenderAsset(
    brandingConfig.logoUrl,
    brandingConfig.logoWidth,
    brandingConfig.logoHeight,
    brandingConfig.logoFit,
  )
  if (!logoAsset) return ''
  const width = clampBrandingDimension(brandingConfig.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const height = clampBrandingDimension(brandingConfig.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
  return `<img src="${logoAsset}" alt="Company Logo" style="width:${width}px;height:${height}px;object-fit:contain;display:block;${extraStyle}" />`
}

export function openPrintWindow(title, bodyHtml, setError) {
  const w = window.open('', '_blank')
  if (!w) {
    setError('Popup blocked. Please allow popups for statement printing')
    return
  }
  w.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; color: #111827; margin: 0; padding: 32px; }
          .sheet { max-width: 980px; margin: 0 auto; }
          .brandbar { height: 10px; background: var(--grad-brand); border-radius: 999px; margin-bottom: 14px; }
          .head { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
          .doc-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
          .company { font-size: 18px; font-weight: 800; margin-bottom: 5px; }
          h1 { font-size: 22px; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; margin: 12px 0; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; font-size: 12px; }
          .note { border: 1px solid #D1D5DB; min-height: 34px; padding: 8px; margin-top: 12px; font-size: 12px; }
          .title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
          .subtitle { color: #065F46; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin: 0 0 8px; }
          .meta { color: #4B5563; font-size: 12px; margin: 2px 0; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #D1D5DB; padding: 7px 8px; text-align: left; }
          th { background: #F3F4F6; }
          .num { text-align: right; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
          .card { border: 1px solid #D1D5DB; padding: 10px; }
          .card-label { color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
          .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 36px; }
          .sign-box { padding-top: 18px; border-top: 1px solid #475569; font-size: 12px; color: #374151; }
          .footer { margin-top: 18px; font-size: 11px; color: #334155; display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } .sheet { max-width: none; } }
        </style>
      </head>
      <body>
        <div class="sheet">${bodyHtml}</div>
      </body>
    </html>
  `)
  w.document.close()
  w.focus()
  w.print()
}

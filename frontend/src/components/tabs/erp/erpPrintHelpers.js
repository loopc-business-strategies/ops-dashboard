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
    { renderScale: 2 },
  )
  if (!logoAsset) return ''
  const width = clampBrandingDimension(brandingConfig.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const height = clampBrandingDimension(brandingConfig.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 140)
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
          body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 20px 18px 16px; font-weight: 500; line-height: 1.35; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
          .sheet { max-width: 980px; width: 100%; margin: 0 auto; box-sizing: border-box; overflow: visible; }
          .brandbar { height: 8px; background: var(--grad-brand); border-radius: 999px; margin-bottom: 12px; }
          .head { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 16px; }
          .doc-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
          .company { font-size: 16px; font-weight: 700; margin-bottom: 4px; line-height: 1.2; overflow-wrap: anywhere; }
          h1 { font-size: 18px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.03em; margin: 10px 0; line-height: 1.2; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; font-size: 11px; font-weight: 500; }
          .note { border: 1px solid #D1D5DB; min-height: 32px; padding: 8px; margin-top: 10px; font-size: 11px; font-weight: 500; overflow-wrap: anywhere; }
          .title { font-size: 18px; font-weight: 700; margin: 0 0 4px; line-height: 1.25; overflow-wrap: anywhere; }
          .subtitle { color: #065F46; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin: 0 0 6px; }
          .meta { color: #4B5563; font-size: 11px; margin: 2px 0; font-weight: 500; overflow-wrap: anywhere; }
          .section { margin-bottom: 16px; }
          .section-title { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
          th, td { border: 1px solid #D1D5DB; padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
          th { background: #F3F4F6; font-weight: 700; }
          .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-right: 8px; }
          .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #D1D5DB; padding: 8px 10px; overflow: visible; }
          .card-label { color: #334155; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
          .card-value { font-size: 15px; font-weight: 700; margin-top: 4px; overflow-wrap: anywhere; }
          .signatures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 28px; }
          .sign-box { padding-top: 14px; border-top: 1px solid #475569; font-size: 11px; color: #374151; font-weight: 600; overflow-wrap: anywhere; }
          .footer { margin-top: 14px; font-size: 10px; color: #334155; display: flex; justify-content: space-between; gap: 12px; font-weight: 500; }
          @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body { padding: 0; }
            .sheet { max-width: none; width: 100%; }
          }
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

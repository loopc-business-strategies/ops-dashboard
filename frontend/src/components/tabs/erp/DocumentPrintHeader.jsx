import {
  DEFAULT_VOUCHER_PRINT,
  DEFAULT_TITLE_ACCENT_COLOR,
  DEFAULT_HEADER_DIVIDER_COLOR,
  STATEMENT_ADDRESS_FONT_MAX,
  STATEMENT_ADDRESS_FONT_MIN,
  STATEMENT_COMPANY_NAME_FONT_MAX,
  STATEMENT_COMPANY_NAME_FONT_MIN,
  clampStatementFontSize,
  normalizeTitleAccentColor,
  normalizeHeaderDividerColor,
} from './ERPBrandingUtils'
import { useDocumentPrintLogo } from '../voucher/useDocumentPrintLogo'

export default function DocumentPrintHeader({ branding, title, meta = [], layoutSettings = null, screenPreview = true }) {
  const companyName = branding?.companyName || ''
  const logoUrl = branding?.logoUrl || ''
  const logoWidth = Number(branding?.logoWidth || 160)
  const logoHeight = Number(branding?.logoHeight || 56)
  const logoFit = branding?.logoFit || 'contain'
  const logoOffsetX = Number(layoutSettings?.logoOffsetX || 0)
  const logoOffsetY = Number(layoutSettings?.logoOffsetY || 0)
  const logoTransparent = layoutSettings?.logoTransparent !== false
  const titleAccentColor = normalizeTitleAccentColor(
    layoutSettings?.titleAccentColor,
    DEFAULT_TITLE_ACCENT_COLOR,
  )
  const headerDividerColor = normalizeHeaderDividerColor(
    layoutSettings?.headerDividerColor,
    DEFAULT_HEADER_DIVIDER_COLOR,
  )
  const companyNameFontSize = clampStatementFontSize(
    layoutSettings?.companyNameFontSize,
    DEFAULT_VOUCHER_PRINT.companyNameFontSize,
    STATEMENT_COMPANY_NAME_FONT_MIN,
    STATEMENT_COMPANY_NAME_FONT_MAX,
  )
  const addressFontSize = clampStatementFontSize(
    layoutSettings?.addressFontSize,
    DEFAULT_VOUCHER_PRINT.addressFontSize,
    STATEMENT_ADDRESS_FONT_MIN,
    STATEMENT_ADDRESS_FONT_MAX,
  )
  const logoFrameWidth = 260
  const logoFrameHeight = 120
  const logoSrc = useDocumentPrintLogo(logoUrl, logoWidth, logoHeight, logoFit, screenPreview)
  const details = [
    branding?.address,
    branding?.phone,
    branding?.trn ? `TRN: ${branding.trn}` : '',
  ].filter(Boolean)

  return (
    <>
      <div data-testid="header-divider" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '18px',
        borderBottom: `2px solid ${headerDividerColor}`,
        paddingBottom: '10px',
        marginBottom: '10px',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {companyName ? <div style={{ fontWeight: '700', fontSize: `${companyNameFontSize}px`, color: '#111827' }}>{companyName}</div> : null}
          {details.map((line, index) => (
            <div key={`${line}-${index}`} style={{ fontSize: `${addressFontSize}px`, color: '#555555', marginTop: index === 0 ? '3px' : '2px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{
          position: 'relative',
          minWidth: `${logoFrameWidth}px`,
          minHeight: `${logoFrameHeight}px`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
        >
          {logoSrc ? (
            <div style={{
              position: 'relative',
              top: `${logoOffsetY}px`,
              right: `${-logoOffsetX}px`,
              background: logoTransparent ? 'transparent' : '#FFFFFF',
            }}
            >
              <img
                src={logoSrc}
                alt="Company Logo"
                style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, maxWidth: `${logoWidth}px`, maxHeight: `${logoHeight}px`, objectFit: logoFit, display: 'block' }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div data-testid="title-accent-line" style={{ flex: 1, borderTop: `3px solid ${titleAccentColor}` }} />
        <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '0.02em', textAlign: 'center', textTransform: 'uppercase' }}>{title}</div>
        <div data-testid="title-accent-line" style={{ flex: 1, borderTop: `3px solid ${titleAccentColor}` }} />
      </div>
      {meta.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', marginBottom: '10px', fontSize: '10px' }}>
          {meta.filter((item) => item?.label).map((item) => (
            <div key={item.label} style={{ border: '1px solid #D1D5DB', padding: '5px 6px' }}>
              <strong>{item.label}</strong>: {item.value || '-'}
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

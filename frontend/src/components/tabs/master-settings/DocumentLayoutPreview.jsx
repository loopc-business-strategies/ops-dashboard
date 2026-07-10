import { useCallback, useRef } from 'react'
import { DEFAULT_TITLE_ACCENT_COLOR, DEFAULT_HEADER_DIVIDER_COLOR, normalizeTitleAccentColor, normalizeHeaderDividerColor } from '../erp/ERPBrandingUtils'

export default function DocumentLayoutPreview({
  branding,
  layoutSettings = {},
  onLayoutChange,
  title = '',
  subtitle = '',
  meta = [],
}) {
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const logoOffsetX = Number(layoutSettings.logoOffsetX || 0)
  const logoOffsetY = Number(layoutSettings.logoOffsetY || 0)
  const logoTransparent = layoutSettings.logoTransparent !== false
  const titleAccentColor = normalizeTitleAccentColor(
    layoutSettings.titleAccentColor,
    DEFAULT_TITLE_ACCENT_COLOR,
  )
  const headerDividerColor = normalizeHeaderDividerColor(
    layoutSettings.headerDividerColor,
    DEFAULT_HEADER_DIVIDER_COLOR,
  )

  const onPointerDown = useCallback((event) => {
    if (!onLayoutChange) return
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: logoOffsetX,
      originY: logoOffsetY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [logoOffsetX, logoOffsetY, onLayoutChange])

  const onPointerMove = useCallback((event) => {
    if (!dragRef.current.active || !onLayoutChange) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    const nextX = Math.min(Math.max(dragRef.current.originX + dx, -120), 120)
    const nextY = Math.min(Math.max(dragRef.current.originY + dy, -120), 120)
    onLayoutChange({ logoOffsetX: nextX, logoOffsetY: nextY })
  }, [onLayoutChange])

  const onPointerUp = useCallback((event) => {
    dragRef.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const details = [branding.address, branding.phone, branding.trn ? `TRN: ${branding.trn}` : ''].filter(Boolean)
  const logoWidth = Number(branding.logoWidth || 160)
  const logoHeight = Number(branding.logoHeight || 56)
  const logoFrameWidth = 260
  const logoFrameHeight = 120

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, background: '#fff' }}>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6B7280' }}>
        Drag the logo to fine-tune its position (top-right anchor).
      </p>
      <div style={{
        border: '1px dashed #CBD5E1',
        borderRadius: 10,
        padding: 12,
        background: '#F8FAFC',
      }}
      >
        <div data-testid="header-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: `2px solid ${headerDividerColor}`, paddingBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {branding.companyName ? (
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{branding.companyName}</div>
            ) : null}
            {details.map((line, index) => (
              <div key={`${line}-${index}`} style={{ fontSize: 10, color: '#555', marginTop: index === 0 ? 3 : 2, whiteSpace: 'pre-line' }}>
                {line}
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', width: logoFrameWidth, minHeight: logoFrameHeight }}>
            {branding.logoUrl ? (
              <div
                role="presentation"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                  position: 'absolute',
                  top: Math.min(Math.max(logoOffsetY, -120), 120),
                  right: -logoOffsetX,
                  cursor: onLayoutChange ? 'grab' : 'default',
                  touchAction: 'none',
                  background: logoTransparent ? 'transparent' : '#fff',
                  border: onLayoutChange ? '1px dashed #94A3B8' : 'none',
                  borderRadius: 4,
                }}
              >
                <img
                  src={branding.logoUrl}
                  alt="Logo preview"
                  style={{
                    width: `${logoWidth}px`,
                    height: `${logoHeight}px`,
                    maxWidth: `${logoWidth}px`,
                    maxHeight: `${logoHeight}px`,
                    objectFit: branding.logoFit || 'contain',
                    display: 'block',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', paddingTop: 8 }}>No logo</div>
            )}
          </div>
        </div>

        {title ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div data-testid="title-accent-line" style={{ flex: 1, borderTop: `3px solid ${titleAccentColor}` }} />
            <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase' }}>{title}</div>
            <div data-testid="title-accent-line" style={{ flex: 1, borderTop: `3px solid ${titleAccentColor}` }} />
          </div>
        ) : null}

        {subtitle ? (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6B7280', textAlign: 'center' }}>{subtitle}</p>
        ) : null}

        {meta.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginTop: 10, fontSize: 10 }}>
            {meta.map((item) => (
              <div key={item.label} style={{ border: '1px solid #D1D5DB', padding: '4px 6px', background: '#fff' }}>
                <strong>{item.label}</strong>: {item.value || '-'}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function DocumentPrintHeader({ branding, title, meta = [], layoutSettings = null }) {
  const companyName = branding?.companyName || ''
  const logoUrl = branding?.logoUrl || ''
  const logoWidth = Number(branding?.logoWidth || 160)
  const logoHeight = Number(branding?.logoHeight || 56)
  const logoFit = branding?.logoFit || 'contain'
  const logoOffsetX = Number(layoutSettings?.logoOffsetX || 0)
  const logoOffsetY = Number(layoutSettings?.logoOffsetY || 0)
  const logoTransparent = layoutSettings?.logoTransparent !== false
  const details = [
    branding?.address,
    branding?.phone,
    branding?.trn ? `TRN: ${branding.trn}` : '',
  ].filter(Boolean)

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '18px',
        borderBottom: '2px solid #111827',
        paddingBottom: '10px',
        marginBottom: '10px',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {companyName ? <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827' }}>{companyName}</div> : null}
          {details.map((line, index) => (
            <div key={`${line}-${index}`} style={{ fontSize: '9px', color: '#555555', marginTop: index === 0 ? '3px' : '2px', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {line}
            </div>
          ))}
        </div>
        <div style={{
          position: 'relative',
          minWidth: `${Math.min(Math.max(logoWidth, 120), 220)}px`,
          minHeight: `${logoHeight}px`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
        >
          {logoUrl ? (
            <div style={{
              position: 'relative',
              top: `${logoOffsetY}px`,
              right: `${-logoOffsetX}px`,
              background: logoTransparent ? 'transparent' : '#FFFFFF',
            }}
            >
              <img
                src={logoUrl}
                alt="Company Logo"
                style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, maxWidth: '220px', maxHeight: '96px', objectFit: logoFit, display: 'block' }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1, borderTop: '3px solid #7F1D1D' }} />
        <div style={{ fontWeight: '700', fontSize: '16px', letterSpacing: '0.02em', textAlign: 'center', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ flex: 1, borderTop: '3px solid #7F1D1D' }} />
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

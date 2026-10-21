export function ProfessionalGoldTitleBar({
  variant = 'currency',
  title,
  goldColor = '#D99A12',
}) {
  const commonOuter =
    variant === 'metal'
      ? { height: '30px', marginBottom: '7px' }
      : { height: '34px', margin: '2px 0 10px' }

  const goldLineTop = variant === 'metal' ? '14px' : '13px'
  const titleTop = variant === 'metal' ? '14px' : '13px'

  const boxStyle =
    variant === 'metal'
      ? {
          borderTop: `2px solid ${goldColor}`,
          borderBottom: `2px solid ${goldColor}`,
          minHeight: '28px',
          fontSize: '15px',
          width: 'min(318px, 100%)',
        }
      : {
          border: `1.2px solid ${goldColor}`,
          minHeight: '28px',
          fontSize: '15px',
          width: 'min(300px, 84%)',
          maxWidth: '92%',
        }

  return (
    <div className="voucher-pro-title" style={{ position: 'relative', ...commonOuter }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: goldLineTop,
          borderTop: `7px solid ${goldColor}`,
          height: 0,
        }}
      />
      <div
        className="voucher-pro-title-box"
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: titleTop,
          zIndex: 1,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '800',
          letterSpacing: '0.01em',
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '3px 12px',
          boxSizing: 'border-box',
          ...boxStyle,
        }}
      >
        {title}
      </div>
    </div>
  )
}


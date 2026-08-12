export function ProfessionalGoldTitleBar({
  variant = 'currency',
  title,
  goldColor = '#D99A12',
}) {
  const commonOuter =
    variant === 'metal'
      ? { height: '28px', marginBottom: '7px' }
      : { height: '31px', margin: '4px 0 13px' }

  const goldLineTop = variant === 'metal' ? '13px' : '12px'
  const titleTop = variant === 'metal' ? '13px' : '12px'

  const boxStyle =
    variant === 'metal'
      ? {
          borderTop: `2px solid ${goldColor}`,
          borderBottom: `2px solid ${goldColor}`,
          minHeight: '27px',
          fontSize: '16px',
          width: 'min(318px, 100%)',
        }
      : {
          border: `1.2px solid ${goldColor}`,
          minHeight: '29px',
          fontSize: '17px',
          width: 'min(286px, 70%)',
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
          fontWeight: '900',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
          padding: '0 8px',
          ...boxStyle,
        }}
      >
        {title}
      </div>
    </div>
  )
}


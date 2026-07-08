import {
  LOGO_SIZE_BASELINE_HEIGHT,
  LOGO_SIZE_BASELINE_WIDTH,
  LOGO_SIZE_MAX_PERCENT,
  LOGO_SIZE_MIN_PERCENT,
  logoSizePercentFromDimensions,
  scaleDocumentLogoSize,
} from './documentLogoChange'

export default function LogoSizeSlider({
  branding,
  onChange,
  disabled = false,
}) {
  const logoWidth = Number(branding?.logoWidth) || LOGO_SIZE_BASELINE_WIDTH
  const logoHeight = Number(branding?.logoHeight) || LOGO_SIZE_BASELINE_HEIGHT
  const scalePercent = logoSizePercentFromDimensions(logoWidth, logoHeight)

  const handleScaleChange = (nextPercent) => {
    const parsed = Number(nextPercent)
    if (!Number.isFinite(parsed)) return
    onChange(scaleDocumentLogoSize({}, parsed))
  }

  const handleReset = () => {
    onChange({
      logoWidth: LOGO_SIZE_BASELINE_WIDTH,
      logoHeight: LOGO_SIZE_BASELINE_HEIGHT,
    })
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
          Logo size: {logoWidth} × {logoHeight} px ({scalePercent}%)
        </label>
        <button
          type="button"
          onClick={handleReset}
          disabled={disabled}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid #D1D5DB',
            background: '#FFFFFF',
            color: '#374151',
            fontSize: 12,
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          Reset
        </button>
      </div>
      <input
        type="range"
        min={LOGO_SIZE_MIN_PERCENT}
        max={LOGO_SIZE_MAX_PERCENT}
        step={5}
        value={scalePercent}
        disabled={disabled}
        onChange={(event) => handleScaleChange(event.target.value)}
        aria-label="Logo size"
        style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF' }}>
        <span>{LOGO_SIZE_MIN_PERCENT}%</span>
        <span>{LOGO_SIZE_MAX_PERCENT}%</span>
      </div>
    </div>
  )
}

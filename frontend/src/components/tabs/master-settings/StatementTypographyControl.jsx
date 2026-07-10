const inputStyle = {
  width: 72,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #E5E7EB',
  fontSize: 13,
}

export default function StatementTypographyControl({
  label,
  value,
  min,
  max,
  defaultValue,
  onChange,
  disabled = false,
}) {
  const currentValue = Number(value)
  const safeValue = Number.isFinite(currentValue) ? currentValue : defaultValue

  const handleChange = (nextValue) => {
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) return
    onChange(Math.min(Math.max(parsed, min), max))
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
          {label}: {safeValue}px
        </label>
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={safeValue}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          aria-label={label}
          style={{ flex: 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={safeValue}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
          aria-label={`${label} in pixels`}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF' }}>
        <span>{min}px</span>
        <span>{max}px</span>
      </div>
    </div>
  )
}

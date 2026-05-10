import { useState } from 'react'

function MiniBarChart({ data = [], valueKey = 'value', labelKey = 'label', color = '#059669', height = 56 }) {
  const [hovered, setHovered] = useState(null)
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${height}px` }}>
        {data.map((item, index) => {
          const pct = Math.max((Number(item[valueKey] || 0) / max) * 100, 2)
          return (
            <div
              key={index}
              style={{ flex: 1, borderRadius: '2px 2px 0 0', background: hovered === index ? '#0EA5E9' : color, height: `${pct}%`, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              title={`${item[labelKey]}: ${Number(item[valueKey] || 0).toLocaleString()}`}
            />
          )
        })}
      </div>
      {hovered !== null && data[hovered] && (
        <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {data[hovered][labelKey]}: {Number(data[hovered][valueKey] || 0).toLocaleString()}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        {data.map((item, index) => (
          <span key={index} style={{ flex: 1, textAlign: 'center', fontSize: '0.62rem', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item[labelKey]}
          </span>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ segments = [], total = 0, label = '' }) {
  const [hovered, setHovered] = useState(null)
  const r = 28
  const cx = 36
  const cy = 36
  const stroke = 14
  let cumAngle = -90
  const arcs = segments.map((seg, index) => {
    const pct = total > 0 ? Number(seg.value) / total : 0
    const angle = pct * 360
    const startAngle = cumAngle
    cumAngle += angle
    const toRad = (deg) => (deg * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(startAngle + angle))
    const y2 = cy + r * Math.sin(toRad(startAngle + angle))
    const large = angle > 180 ? 1 : 0
    return { ...seg, index, x1, y1, x2, y2, large, angle, pct }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8F5EF" strokeWidth={stroke} />
        {arcs.map((arc) => arc.angle < 0.5 ? null : (
          <path
            key={arc.index}
            d={`M ${arc.x1} ${arc.y1} A ${r} ${r} 0 ${arc.large} 1 ${arc.x2} ${arc.y2}`}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === arc.index ? stroke + 2 : stroke}
            onMouseEnter={() => setHovered(arc.index)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
          />
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#111">{label}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {arcs.map((arc) => (
          <div
            key={arc.index}
            onMouseEnter={() => setHovered(arc.index)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: hovered === arc.index ? '#111' : '#6B7280', cursor: 'default', fontWeight: hovered === arc.index ? '600' : '400' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: arc.color, flexShrink: 0, display: 'inline-block' }} />
            {arc.label} {(arc.pct * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}

export {
  DonutChart,
  MiniBarChart,
}
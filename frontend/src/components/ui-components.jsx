// FILE: src/components/ui-components.jsx
// Shared UI primitives — design-system.css powered
// All components rely on CSS variables defined in design-system.css

// ── Card ─────────────────────────────────────────
export function Card({ children, className = '', style = {} }) {
  return (
    <div className={`ds-card ${className}`} style={style}>
      {children}
    </div>
  )
}

// ── StatCard ─────────────────────────────────────
// icon: emoji or SVG element
// trend: '+12%' | '-3%' | null  (positive = green, negative = red)
export function StatCard({ label, value, icon, trend, sub, className = '' }) {
  const trendPos = trend && !trend.startsWith('-')
  return (
    <div className={`ds-stat-card ${className}`}>
      <div className="ds-stat-icon">{icon}</div>
      <div className="ds-stat-value">{value}</div>
      <div className="ds-stat-label">{label}</div>
      {(trend || sub) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {trend && (
            <span style={{ fontSize: 11, color: trendPos ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              {trendPos ? '▲' : '▼'} {trend}
            </span>
          )}
          {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────
// variant: 'success' | 'progress' | 'pending' | 'info' | 'muted' | 'danger' | 'orange'
export function Badge({ children, variant = 'muted' }) {
  return <span className={`ds-badge ds-badge-${variant}`}>{children}</span>
}

// ── Button ────────────────────────────────────────
// variant: 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({ children, variant = 'primary', onClick, disabled = false, style = {}, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ds-btn ds-btn-${variant} ${className}`}
      style={style}
    >
      {children}
    </button>
  )
}

// ── Table ─────────────────────────────────────────
// headers: string[]
// rows: array of arrays (cells per row)
// Can also pass children for custom <tbody> content
export function Table({ headers, rows, children, className = '' }) {
  return (
    <div className={`ds-table-wrap ${className}`}>
      <table className="ds-table">
        {headers && (
          <thead>
            <tr>
              {headers.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
        )}
        <tbody>
          {rows
            ? rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))
            : children}
        </tbody>
      </table>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────
// onClose: () => void
// title: string
export function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div className="ds-modal-overlay" onClick={onClose}>
      <div
        className="ds-modal"
        style={{ width: '100%', maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h3 className="ds-modal-title">{title}</h3>
          <button className="ds-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ds-modal-body">{children}</div>
      </div>
    </div>
  )
}

// ── ProgressBar ───────────────────────────────────
// value: 0–100 number
// label: string shown above bar
// showPct: bool (default true)
// variant: 'default' | 'orange' (default uses brand gradient)
export function ProgressBar({ value = 0, label, showPct = true, variant = 'default' }) {
  const clamp = Math.max(0, Math.min(100, value))
  const bg = variant === 'orange' ? '#f97316' : undefined  // undefined → CSS var handles it
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          {showPct && <span style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 600 }}>{clamp}%</span>}
        </div>
      )}
      <div className="ds-progress">
        <div
          className="ds-progress-bar"
          style={{ width: `${clamp}%`, ...(bg ? { background: bg } : {}) }}
        />
      </div>
    </div>
  )
}

// ── SectionHeader ─────────────────────────────────
// icon: emoji/char, title: string, action: optional JSX (button etc.)
export function SectionHeader({ icon, title, action, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span>{icon}</span>}
          {title}
        </h2>
        {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── TabsBar ───────────────────────────────────────
// tabs: [{ id, label, icon? }]
// active: string
// onChange: (id) => void
export function TabsBar({ tabs, active, onChange }) {
  return (
    <div className="ds-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`ds-tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <span style={{ marginRight: 5 }}>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── FormField ────────────────────────────────────
// type: 'text' | 'number' | 'select' | 'textarea' | 'date'
// options: [{ value, label }] for select
export function FormField({ label, type = 'text', value, onChange, options = [], placeholder = '', required = false, rows = 3 }) {
  const id = `ff-${label?.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="ds-form-field">
      {label && <label className="ds-label" htmlFor={id}>{label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}</label>}
      {type === 'select' ? (
        <select id={id} className="ds-input" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">-- Select --</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={id} className="ds-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
      ) : (
        <input id={id} className="ds-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
      )}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────
// name: string (uses first char)
// size: number (px, default 32)
export function Avatar({ name = '?', size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: 'var(--grad-brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4, color: '#fff', flexShrink: 0,
      textTransform: 'uppercase',
    }}>
      {name[0] || '?'}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────
// Render at bottom-right. Pass { title, msg } or null.
export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="ds-toast">
      <strong style={{ display: 'block', marginBottom: 2 }}>{toast.title}</strong>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{toast.msg}</span>
    </div>
  )
}

// ── RestrictedNotice ─────────────────────────────
// Used when a role cannot access a section
export function RestrictedNotice({ message = "You don't have permission to view this section." }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 24px',
      color: 'var(--text-muted)', fontSize: 14,
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <p>{message}</p>
    </div>
  )
}

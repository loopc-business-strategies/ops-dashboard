// FILE: src/components/ui-components.jsx
// Shared UI primitives — design-system.css powered (.card / .btn / .badge / …)

export function Card({ children, className = '', style = {}, title, subtitle, actions }) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-title">
          <div>
            {title}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({ label, value, icon, trend, sub, className = '' }) {
  const trendPos = trend && !String(trend).startsWith('-')
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {icon && <span aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-card-value">{value}</div>
      {(trend || sub) && (
        <div className="stat-card-sub">
          {trend && (
            <span style={{ color: trendPos ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
              {trendPos ? '▲' : '▼'} {trend}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  )
}

export function KpiCard(props) {
  return <StatCard {...props} />
}

export function Badge({ children, variant = 'muted' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

export function StatusBadge({ status = 'pending', children }) {
  const map = {
    paid: 'success',
    posted: 'success',
    approved: 'success',
    completed: 'success',
    active: 'success',
    pending: 'progress',
    processing: 'progress',
    draft: 'muted',
    inactive: 'muted',
    cancelled: 'danger',
    rejected: 'danger',
    returned: 'orange',
  }
  const key = String(status || '').toLowerCase()
  return <Badge variant={map[key] || 'pending'}>{children || status}</Badge>
}

export function Button({
  children,
  variant = 'primary',
  onClick,
  disabled = false,
  style = {},
  className = '',
  type = 'button',
  loading = false,
  size,
}) {
  const sizeClass = size === 'sm' ? 'btn-sm' : ''
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      style={style}
      aria-busy={loading || undefined}
    >
      {loading ? '…' : children}
    </button>
  )
}

export function Table({ headers, rows, children, className = '', title, subtitle }) {
  return (
    <div className={`table-wrapper ${className}`}>
      {(title || subtitle) && (
        <div className="table-header">
          <div>
            {title && <div className="table-title">{title}</div>}
            {subtitle && <div className="table-subtitle">{subtitle}</div>}
          </div>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
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
    </div>
  )
}

export function Modal({ title, onClose, children, width = 500, footer }) {
  return (
    <div className="modal-overlay open" onClick={onClose} role="presentation">
      <div
        className="modal-box"
        style={{ width: '100%', maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 className="modal-title" style={{ marginBottom: 0 }}>{title}</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ title, onClose, children, width = 420, footer }) {
  return (
    <div className="modal-overlay open" onClick={onClose} role="presentation">
      <div
        className="drawer-panel"
        style={{ width: 'min(100%, ' + width + 'px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer-header">
          <h3 className="modal-title" style={{ marginBottom: 0 }}>{title}</h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ProgressBar({ value = 0, label, showPct = true }) {
  const clamp = Math.max(0, Math.min(100, value))
  return (
    <div className="progress-row">
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-track">
        <div className="progress-fill progress-fill-brand" style={{ width: `${clamp}%` }} />
      </div>
      {showPct && <span className="progress-pct">{clamp}%</span>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <div className="page-header section-header">
      <div>
        <h1 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {title}
        </h1>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  )
}

export function SectionHeader({ icon, title, action, sub }) {
  return <PageHeader title={title} subtitle={sub} actions={action} icon={icon} />
}

export function TabsBar({ tabs, active, onChange }) {
  return (
    <div className="tabs-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-btn${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span style={{ marginRight: 5 }}>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function FormField({ label, type = 'text', value, onChange, options = [], placeholder = '', required = false, rows = 3, helper, error }) {
  const id = `ff-${String(label || 'field').replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {type === 'select' ? (
        <select id={id} className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">-- Select --</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={id} className="form-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} />
      ) : (
        <input id={id} className="form-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
      )}
      {helper && !error && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{helper}</p>}
      {error && <p style={{ fontSize: 11, color: 'var(--danger)', margin: 0 }}>{error}</p>}
    </div>
  )
}

export function FilterBar({ children, className = '' }) {
  return <div className={`filter-bar ${className}`.trim()}>{children}</div>
}

export function EmptyState({ title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {message && <p className="empty-state-msg">{message}</p>}
      {action}
    </div>
  )
}

export function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="empty-state" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${80 - i * 12}%`, marginBottom: 8 }} />
      ))}
    </div>
  )
}

export function ChartCard({ title, subtitle, children, actions }) {
  return (
    <Card title={title} subtitle={subtitle} actions={actions} className="chart-card">
      {children}
    </Card>
  )
}

export function Avatar({ name = '?', size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: 'var(--brand-button-bg, var(--brand-dark))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.4, color: '#fff', flexShrink: 0,
      textTransform: 'uppercase',
    }}>
      {name[0] || '?'}
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast show`}>
      <strong className="toast-title">{toast.title}</strong>
      <span className="toast-msg">{toast.msg}</span>
    </div>
  )
}

export function RestrictedNotice({ message = "You don't have permission to view this section." }) {
  return (
    <EmptyState title="Restricted" message={message} />
  )
}

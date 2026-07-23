// ── Notifications Panel ───────────────────────────
function NotificationsPanel({ open, onClose, notifications, onAcknowledge, onEscalate, onDismiss, onMarkAllRead, onClearRead, filter, onFilterChange }) {
  const unread = notifications.filter(n => !n.read).length
  const filtered = (() => {
    if (filter === 'unread')  return notifications.filter(n => !n.read)
    if (filter === 'crit')    return notifications.filter(n => n.level === 'crit')
    if (filter === 'high')    return notifications.filter(n => n.level === 'high')
    if (filter === 'med')     return notifications.filter(n => n.level === 'med')
    if (filter === 'info')    return notifications.filter(n => ['info', 'success'].includes(n.level))
    return notifications
  })()

  return (
    <>
      <div className={`notif-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`notif-panel ${open ? 'open' : ''}`}>
        <div className="np-header">
          <div className="np-title">
            🔔 Notifications
            {unread > 0 && <span className="np-title-badge">{unread} new</span>}
          </div>
          <button className="np-close" onClick={onClose}>✕</button>
        </div>

        <div className="np-filters">
          {[
            { key: 'all',    label: `All (${notifications.length})` },
            { key: 'unread', label: `Unread (${unread})` },
            { key: 'crit',   label: '🔴 Critical' },
            { key: 'high',   label: '🟠 High' },
            { key: 'med',    label: '🟡 Medium' },
            { key: 'info',   label: '🔵 Info' },
          ].map(f => (
            <button key={f.key} className={`np-filter-btn ${filter === f.key ? 'active' : ''}`}
                    onClick={() => onFilterChange(f.key)}>{f.label}</button>
          ))}
        </div>

        <div className="np-body">
          {filtered.length === 0 ? (
            <div className="np-empty">
              <div className="np-empty-icon">🔕</div>
              <div>No notifications</div>
            </div>
          ) : filtered.map(n => (
            <div key={n.id} className={`np-item ${n.level} ${n.read ? 'read' : ''}`}>
              <div className="np-item-head">
                <div className="np-item-title">{n.title}</div>
                <div className="np-item-time">{n.time}</div>
              </div>
              <div className="np-item-desc">{n.desc}</div>
              <div className="np-item-meta">📍 {n.meta}</div>
              <div className="np-item-actions">
                {!n.read && (
                  <button className="np-action-btn np-btn-ack" onClick={() => onAcknowledge(n.id)}>
                    ✓ Acknowledge
                  </button>
                )}
                {(n.level === 'crit' || n.level === 'high') && !n.acked && (
                  <button className="np-action-btn np-btn-esc" onClick={() => onEscalate(n.id)}>
                    ↑ Escalate
                  </button>
                )}
                <button className="np-action-btn np-btn-dis" onClick={() => onDismiss(n.id)}>
                  × Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="np-footer">
          <button className="np-footer-btn pri" onClick={onMarkAllRead}>✓ Mark all read</button>
          <button className="np-footer-btn sec" onClick={onClearRead}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

export default NotificationsPanel

import { C } from './ui'

export function NotificationsPanel({ open, onClose, notifications, onAck, onDismiss, onMarkAllRead, onClearRead }) {
  const unread = notifications.filter(n => !n.read).length
  const lvColor = { crit:C.red, high:C.orange, med:C.yellow, info:C.cyan, suc:C.green }

  return (
    <>
      <div className={`notif-overlay${open?' open':''}`} onClick={onClose} />
      <div className={`notif-panel${open?' open':''}`}>
        <div className="np-header">
          <div className="np-title">
            🔔 Finance Alerts
            {unread > 0 && <span className="np-title-badge">{unread} new</span>}
          </div>
          <button className="np-close" onClick={onClose}>✕</button>
        </div>
        <div className="np-body">
          {notifications.length === 0
            ? <div className="np-empty">No alerts for your role</div>
            : notifications.map(n => (
              <div key={n.id} className={`np-item ${n.lv}`} style={{ opacity:n.read?0.6:1 }}>
                <div className="np-item-head">
                  <div className="np-item-title" style={{ color:lvColor[n.lv]||C.t2 }}>{n.title}</div>
                  <div className="np-item-time">{n.time}</div>
                </div>
                <div className="np-item-desc">{n.desc}</div>
                <div className="np-item-actions">
                  {!n.read && <button className="np-action-btn np-btn-ack" onClick={() => onAck(n.id)}>✓ Acknowledge</button>}
                  <button className="np-action-btn np-btn-esc">↑ Escalate</button>
                  <button className="np-action-btn np-btn-dis" onClick={() => onDismiss(n.id)}>✕ Dismiss</button>
                </div>
              </div>
            ))
          }
        </div>
        <div className="np-footer">
          <button className="np-footer-btn pri" onClick={onMarkAllRead}>✓ Mark all read</button>
          <button className="np-footer-btn sec" onClick={onClearRead}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

import { OPS_BADGE_MAP, OPS_C as C, OPS_INPUT_STYLE as IS, OPS_TD as TD, OPS_TH as TH } from './operationsTabTokens'

export { OPS_C as C, OPS_TD as TD, OPS_TH as TH, OPS_INPUT_STYLE as IS } from './operationsTabTokens'
export { OPS_B as B } from './operationsTabTokens'

export function stars(n) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < n ? C.gold : C.t4, fontSize: 14 }}>★</span>
  ))
}

export function Badge({ s }) {
  const cf = OPS_BADGE_MAP[s] || { bg: 'rgba(255,255,255,.05)', color: '#475569', b: 'rgba(255,255,255,.1)' }
  return <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cf.bg, color: cf.color, border: `1px solid ${cf.b}`, whiteSpace: 'nowrap' }}>{s}</span>
}

export function ProgBar({ pct: p, color, height = 7 }) {
  return (
    <div style={{ flex: 1, height, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
    </div>
  )
}

export function ProgRow({ label, p, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12 }}>
      <div style={{ width: 160, color: C.t2, fontWeight: 500, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <ProgBar pct={p} color={color} />
      <div style={{ width: 38, textAlign: 'right', fontWeight: 700, color: C.t1, fontSize: 12 }}>{p}%</div>
    </div>
  )
}

export function StatCard({ label, value, sub, dot }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.gbar }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, lineHeight: 1 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: C.t3, marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
          {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />}
          {sub}
        </div>
      )}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.gbar }} />
      {children}
    </div>
  )
}

export function CardTitle({ children, right }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color: C.t1, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{children}{right && <div>{right}</div>}</div>
}

export function TableWrap({ children }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>{children}</div>
}

export function TableHead({ title, subtitle, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  )
}

export function SH({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.t3, marginTop: 3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 2 }}>{children}</div>}
    </div>
  )
}

export function Restrict({ text, amber }) {
  const col = amber ? C.gold : C.red
  return (
    <div style={{ background: `${col}10`, border: `1px solid ${col}25`, borderRadius: 10, padding: '13px 16px', fontSize: 13, color: col, display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1.5 }}>
      <span style={{ fontSize: 20 }}>🔒</span>
      {text}
    </div>
  )
}

export function ML({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{children}</div>
}

export function MI(props) {
  return <input {...props} style={IS} />
}

export function MS({ children, ...p }) {
  return <select {...p} style={{ ...IS, appearance: 'auto' }}>{children}</select>
}

export function MTA(props) {
  return <textarea {...props} style={{ ...IS, resize: 'vertical', minHeight: 65 }} />
}

export function Modal({ title, sub, onClose, onSave, saveLabel = 'Save', children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#ffffff', border: `1px solid ${C.border2}`, borderRadius: 14, padding: 24, width: 580, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: C.grad, borderRadius: '14px 0 0 14px' }} />
        <button type="button" onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}>✕</button>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{title}</h3>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 18 }}>{sub}</div>
        {children}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: 'rgba(255,255,255,.07)', color: C.t2 }}>Cancel</button>
          <button type="button" onClick={onSave} style={{ flex: 1, padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: C.grad, color: '#fff' }}>{saveLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ t }) {
  if (!t) return null
  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, minWidth: 260, background: '#ffffff', border: `1px solid ${C.border2}`, borderLeft: '3px solid var(--purple)', borderRadius: 10, padding: '13px 18px', zIndex: 9999, boxShadow: '0 8px 30px rgba(var(--purple-rgb),.22)' }}>
      <style>{`@keyframes toastIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ fontWeight: 700, color: C.t1, marginBottom: 3, animation: 'toastIn .3s ease' }}>{t.title}</div>
      <div style={{ fontSize: 12, color: C.t3 }}>{t.msg}</div>
    </div>
  )
}

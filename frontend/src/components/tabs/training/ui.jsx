// Shared Training tab UI primitives

export const C = {
  grad:   'var(--grad-brand)',
  gbar:   'var(--grad-bar)',
  green:  '#065f46', cyan:   '#00b4d8', yellow: '#ffd600',
  orange: '#9a3412', red:    '#ff4757', gold:   '#f59e0b',
  t1:'#1c2a33', t2:'#374151', t3:'#334155', t4:'#475569',
  border: 'rgba(var(--purple-rgb),0.15)', border2:'rgba(var(--purple-rgb),0.35)',
  card:'#ffffff', card2:'#f8f9fa', inp:'#f8f9fa',
  pur: 'var(--purple)',
}
export const B = {
  pri:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:C.grad, color:'#fff', boxShadow:'0 4px 15px rgba(var(--purple-rgb),.35)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sec:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'var(--purple)', border:'1px solid var(--purple)', whiteSpace:'nowrap', fontFamily:'inherit' },
  ghost: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'#475569', border:`1px solid ${C.border}`, whiteSpace:'nowrap', fontFamily:'inherit' },
  succ:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(0,200,150,.15)', color:'#065f46', border:'1px solid rgba(0,200,150,.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sm:    { padding:'5px 11px', fontSize:11 },
}

// Seed data lives in ./trainingSeedData.js (imported by tab panels).

// ─── Helpers ────────────────────────────────────────────────────────────────────
export function pct(v, t) { return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100))) }
export function avg(arr, key) { if (!arr.length) return 0; return (arr.reduce((a, b) => a + b[key], 0) / arr.length).toFixed(1) }

const BADGE_MAP = {
  'Active':        { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Completed':     { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Issued':        { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Pass':          { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'Present':       { bg:'rgba(0,200,150,.12)',   color:'#065f46', b:'rgba(0,200,150,.3)' },
  'On Hold':       { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Pending':       { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Late':          { bg:'rgba(255,214,0,.10)',   color:'#ffd600', b:'rgba(255,214,0,.3)' },
  'Scheduled':     { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Expired':       { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Fail':          { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Absent':        { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'Cancelled':     { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
  'PDF':           { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Video':         { bg:'rgba(255,112,67,.12)',  color:'#9a3412', b:'rgba(255,112,67,.3)' },
  'Document':      { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Advanced':      { bg:'rgba(0,180,216,.12)',   color:'#00b4d8', b:'rgba(0,180,216,.3)' },
  'Intermediate':  { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Expert':        { bg:'rgba(var(--purple-rgb),.15)',  color:'var(--purple)', b:'rgba(var(--purple-rgb),.3)' },
  'Basic':         { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' },
  'Beginner':      { bg:'rgba(255,71,87,.12)',   color:'#ff4757', b:'rgba(255,71,87,.3)' },
}
export function Badge({ s }) {
  const cf = BADGE_MAP[s] || { bg:'rgba(255,255,255,.05)', color:'#475569', b:'rgba(255,255,255,.1)' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:cf.bg, color:cf.color, border:`1px solid ${cf.b}`, whiteSpace:'nowrap' }}>{s}</span>
}

export function Stars({ n, size=14 }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize:size, color: i < Math.round(n) ? C.gold : C.t4 }}>★</span>
      ))}
    </span>
  )
}

export function ProgBar({ p, color, height=7 }) {
  return (
    <div style={{ flex:1, height, background:'rgba(255,255,255,.06)', borderRadius:4, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${p}%`, background:color, borderRadius:4, transition:'width .5s' }} />
    </div>
  )
}
export function ProgRow({ label, p, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
      <div style={{ width:160, color:C.t2, fontWeight:500, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
      <ProgBar p={p} color={color} />
      <div style={{ width:36, textAlign:'right', fontWeight:700, color:C.t1, fontSize:12 }}>{p}%</div>
    </div>
  )
}

export function StatCard({ label, value, sub, dot, bottom }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:C.t1, lineHeight:1 }}>{value}</div>
      {sub && !bottom && <div style={{ fontSize:11, color:C.t3, marginTop:7, display:'flex', alignItems:'center', gap:5 }}>
        {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }} />}
        {sub}
      </div>}
      {bottom && <div style={{ marginTop:8 }}>{bottom}</div>}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      {children}
    </div>
  )
}
export function CardTitle({ children }) {
  return <div style={{ fontSize:13, fontWeight:800, color:C.t1, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>{children}</div>
}
export function TableWrap({ children }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>{children}</div>
}
export function TableHead({ title, subtitle, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:`1px solid ${C.border}`, flexWrap:'wrap', gap:8 }}>
      <div>
        <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ display:'flex', gap:8 }}>{right}</div>}
    </div>
  )
}
export const TH = { fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, background:'rgba(255,255,255,.02)', whiteSpace:'nowrap' }
export const TD = { padding:'11px 14px', borderBottom:'1px solid rgba(255,255,255,.04)', fontSize:12.5, color:C.t2, verticalAlign:'middle' }

export function SH({ title, sub, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display:'flex', gap:8, flexShrink:0, marginTop:2 }}>{children}</div>}
    </div>
  )
}
export function Restrict({ text }) {
  return <div style={{ background:'rgba(255,71,87,.07)', border:'1px solid rgba(255,71,87,.18)', borderRadius:10, padding:'13px 16px', fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:10, lineHeight:1.5 }}><span style={{ fontSize:20 }}>🔒</span>{text}</div>
}

// ─── Modal base ─────────────────────────────────────────────────────────────────
export const IS = { width:'100%', background:'rgba(255,255,255,.05)', border:'1.5px solid rgba(var(--purple-rgb),.25)', borderRadius:8, padding:'10px 14px', fontSize:13, color:C.t1, fontFamily:'inherit', outline:'none', marginBottom:12, boxSizing:'border-box' }
export function ML({ children }) { return <div style={{ fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{children}</div> }
export function MI(props) { return <input {...props} style={IS} /> }
export function MS({ children, ...p }) { return <select {...p} style={{ ...IS, appearance:'auto' }}>{children}</select> }
export function MTA(props) { return <textarea {...props} style={{ ...IS, resize:'vertical', minHeight:65 }} /> }
export function Modal({ title, sub, onClose, onSave, saveLabel = 'Save', wide, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#ffffff', border:`1px solid ${C.border2}`, borderRadius:14, padding:24, width: wide ? 720 : 560, maxWidth:'94vw', maxHeight:'88vh', overflowY:'auto', position:'relative' }}>
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:C.grad, borderRadius:'14px 0 0 14px' }} />
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        <h3 style={{ fontSize:17, fontWeight:800, color:C.t1, marginBottom:4 }}>{title}</h3>
        <div style={{ fontSize:12, color:C.t3, marginBottom:18 }}>{sub}</div>
        {children}
        {onSave && <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Cancel</button>
          <button onClick={onSave} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>{saveLabel}</button>
        </div>}
        {!onSave && <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:'rgba(255,255,255,.07)', color:C.t2 }}>Close</button>
        </div>}
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────────
export function Toast({ t }) {
  if (!t) return null
  return (
    <div style={{ position:'fixed', bottom:22, right:22, minWidth:260, background:'#ffffff', border:`1px solid ${C.border2}`, borderLeft:`3px solid var(--purple)`, borderRadius:10, padding:'13px 18px', zIndex:9999, boxShadow:'0 8px 30px rgba(var(--purple-rgb),.22)', animation:'toastIn .3s ease' }}>
      <style>{`@keyframes toastIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ fontWeight:700, color:C.t1, marginBottom:3 }}>{t.title}</div>
      <div style={{ fontSize:12, color:C.t3 }}>{t.msg}</div>
    </div>
  )
}

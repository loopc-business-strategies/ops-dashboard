import { formatMoney } from '../../../utils/money'

export const C = {
  grad:   'var(--brand-primary)',
  gbar:   'var(--brand-primary)',
  gfin:   'var(--brand-primary)',
  green:  '#065f46', cyan:   '#00b4d8', yellow: '#ffd600',
  orange: '#9a3412', red:    '#ff4757', gold:   '#f59e0b',
  t1:'#1c2a33', t2:'#374151', t3:'#334155', t4:'#475569',
  border: 'var(--brand-border)', border2:'rgba(var(--brand-rgb),0.35)',
  card:'#ffffff', inp:'#f8f9fa',
}

export const B = {
  pri:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:'var(--brand-primary)', color:'#fff', boxShadow:'none', whiteSpace:'nowrap', fontFamily:'inherit' },
  sec:   { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'var(--brand-primary)', border:'1px solid var(--brand-primary)', whiteSpace:'nowrap', fontFamily:'inherit' },
  ghost: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'transparent', color:'#475569', border:'1px solid var(--brand-border)', whiteSpace:'nowrap', fontFamily:'inherit' },
  succ:  { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', background:'rgba(0,200,150,0.15)', color:'#065f46', border:'1px solid rgba(0,200,150,0.3)', whiteSpace:'nowrap', fontFamily:'inherit' },
  sm:    { padding:'5px 11px', fontSize:11 },
}

export function ML({ children }) {
  return <span style={{ display:'block', fontSize:11, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{children}</span>
}

// ─── Helpers ──────────────────────────────────────────────────
// Module-level currency for panel helpers below; set from FinanceTab when currencies load.
let financeBaseCurrencyCode = 'USD'
export { financeBaseCurrencyCode }
export function setFinanceBaseCurrencyCode(code) {
  financeBaseCurrencyCode = String(code || 'USD').trim().toUpperCase() || 'USD'
}
export function fmt(n) {
  const code = financeBaseCurrencyCode
  const num = Number(n || 0)
  if (!Number.isFinite(num)) return formatMoney(0, code)
  if (Math.abs(num) >= 1000000) return `${code} ${(num / 1000000).toFixed(2)}M`
  if (Math.abs(num) >= 1000) return `${code} ${(num / 1000).toFixed(0)}k`
  return formatMoney(num, code)
}
export function fmtFull(n) {
  return formatMoney(n, financeBaseCurrencyCode)
}
export function pct(v,t)    { return Math.max(0,Math.min(100,Math.round((v/t)*100))) }

// ─── Shared UI ────────────────────────────────────────────────
export function Badge({ status }) {
  const V = {
    Confirmed:     ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Paid:          ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Approved:      ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Filed:         ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    'On Track':    ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Processed:     ['rgba(0,200,150,.15)','#065f46','rgba(0,200,150,.3)'],
    Sent:          ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Current:       ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    'Under Review':['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Scheduled:     ['rgba(0,180,216,.12)','#00b4d8','rgba(0,180,216,.3)'],
    Pending:       ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    'Due Soon':    ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    Warning:       ['rgba(255,214,0,.12)','#ffd600','rgba(255,214,0,.3)'],
    Draft:         ['rgba(255,255,255,.05)','#475569','rgba(255,255,255,.1)'],
    Overdue:       ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    Rejected:      ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    'Over Budget': ['rgba(255,71,87,.12)','#ff4757','rgba(255,71,87,.3)'],
    Disputed:      ['rgba(255,112,67,.12)','#9a3412','rgba(255,112,67,.3)'],
  }
  const [bg,color,border] = V[status] || ['rgba(255,255,255,.05)','#475569','rgba(255,255,255,.1)']
  return <span style={{ display:'inline-flex', alignItems:'center', borderRadius:999, padding:'4px 12px', fontSize:11, fontWeight:700, whiteSpace:'nowrap', background:bg, color, border:`1px solid ${border}` }}>{status}</span>
}

export function Td({ children, style={} }) {
  return <td style={{ padding:'11px 14px', fontSize:'12.5px', color:C.t2, verticalAlign:'middle', ...style }}>{children}</td>
}

export function Card({ title, titleRight, children, style={} }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 18px', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      {title && (
        <div style={{ fontSize:13, fontWeight:800, color:C.t1, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{title}</span>{titleRight}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, color=C.t1, progress, children }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', position:'relative', overflow:'hidden', cursor:'default' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.gbar }} />
      <div style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.t3, marginTop:7, display:'flex', alignItems:'center', gap:5 }}>{sub}</div>}
      {progress !== undefined && (
        <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1, height:6, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
            <div style={{ width:`${progress}%`, height:'100%', borderRadius:999, background:C.gfin }} />
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:C.t1, width:34, textAlign:'right' }}>{progress}%</span>
        </div>
      )}
      {children}
    </div>
  )
}

export function SectionHeader({ title, sub, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 }}>
      <div>
        <div style={{ fontSize:16, fontWeight:800, color:C.t1 }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:C.t3, marginTop:3 }}>{sub}</div>}
      </div>
      {children && <div style={{ display:'flex', gap:8, flexShrink:0 }}>{children}</div>}
    </div>
  )
}

export function Restricted({ msg }) {
  return (
    <div style={{ background:'rgba(255,71,87,.07)', border:'1px solid rgba(255,71,87,.18)', borderRadius:10, padding:'13px 16px', fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:20 }}>🔒</span>{msg}
    </div>
  )
}

export function PieLegend({ items }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {items.map((item,i) => (
        <div key={i}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:item.color, flexShrink:0 }} />
            <div style={{ flex:1, color:C.t2 }}>{item.label}</div>
            <div style={{ fontWeight:700, color:item.color }}>{item.pct}%</div>
          </div>
          <div style={{ marginLeft:18, marginTop:2, marginBottom:2 }}>
            <div style={{ height:5, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
              <div style={{ width:`${item.pct}%`, height:'100%', background:item.color, borderRadius:999 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressRow({ label, value, max, color=C.gbar, valLabel }) {
  const p = pct(value,max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12 }}>
      <div style={{ width:190, color:C.t2, fontWeight:500, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ flex:1, height:7, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:999, background:color }} />
      </div>
      <div style={{ width:50, textAlign:'right', fontWeight:700, color:C.t1 }}>{valLabel || `${p}%`}</div>
    </div>
  )
}

export function InlineBar({ value, max, color=C.gfin }) {
  const p = pct(value,max)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'rgba(255,255,255,.06)', borderRadius:999, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:999, background:color }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color: p>=80?C.yellow:C.t1, width:34, textAlign:'right' }}>{p}%</span>
    </div>
  )
}

export function DataTable({ title, sub, toolbar, headers, children }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
      {(title||toolbar) && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.t1 }}>{title}</div>
            {sub && <div style={{ fontSize:12, color:C.t3, marginTop:2 }}>{sub}</div>}
          </div>
          {toolbar}
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f0faf5' }}>
              {headers.map((h,i) => (
                <th key={i} style={{ fontSize:10, fontWeight:700, color:C.t3, textTransform:'uppercase', letterSpacing:'.08em', padding:'10px 14px', textAlign:'left', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

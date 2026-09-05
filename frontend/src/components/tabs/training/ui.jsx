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

function getTrainingTabs(t) {
  return [
    { id:'kpi',         label:`📊 ${t('overview')}` },
    { id:'calendar',    label:`📅 ${t('calendar')}` },
    { id:'batches',     label:`👥 ${t('batches')}` },
    { id:'attendance',  label:`📋 ${t('attendance')}` },
    { id:'resources',   label:`📚 ${t('resources')}` },
    { id:'assessments', label:`📝 ${t('assessments')}` },
    { id:'certs',       label:`🏆 ${t('certifications')}` },
    { id:'feedback',    label:`💬 ${t('feedback')}` },
    { id:'analytics',   label:`📈 ${t('analytics')}` },
    { id:'trainees',    label:`👤 ${t('trainees')}` },
    { id:'skillgap',    label:`🗓️ ${t('skillGap')}` },
  ]
}

// ─── Seed data ──────────────────────────────────────────────────────────────────
const INIT_SESSIONS = [
  { id:1, title:'Gold Safety — Module 1',   prog:'Gold Safety Essentials',   date:'Apr 13', day:13, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Completed' },
  { id:2, title:'Equipment Operation',       prog:'Equipment Operation',       date:'Apr 14', day:14, time:'10:30', trainer:'Nadia K.', batch:'Batch B', venue:'Site Floor',        st:'Scheduled' },
  { id:3, title:'Compliance Basics',         prog:'Compliance & Legal',        date:'Apr 15', day:15, time:'14:00', trainer:'Sara A.',  batch:'Batch C', venue:'Online — Zoom',     st:'Scheduled' },
  { id:4, title:'Leadership Workshop',       prog:'Leadership Development',    date:'Apr 17', day:17, time:'11:00', trainer:'James O.', batch:'Batch D', venue:'Classroom B',       st:'Scheduled' },
  { id:5, title:'Gold Safety — Module 2',   prog:'Gold Safety Essentials',   date:'Apr 20', day:20, time:'09:00', trainer:'James O.', batch:'Batch A', venue:'Training Room A',  st:'Scheduled' },
  { id:6, title:'Tech Skills — Excel',       prog:'Tech Skills',               date:'Apr 10', day:10, time:'13:00', trainer:'Nadia K.', batch:'Batch E', venue:'Online — Zoom',     st:'Completed' },
  { id:7, title:'Safety Drill',              prog:'Gold Safety Essentials',   date:'Apr 8',  day:8,  time:'08:00', trainer:'Sara A.',  batch:'Batch A', venue:'Site Floor',        st:'Cancelled' },
]

const INIT_BATCHES = [
  { id:1, name:'Batch A — Gold Safety',   prog:'Gold Safety Essentials',  start:'Apr 1, 2026',  end:'Apr 30, 2026',  trainer:'James O.', trainees:12, st:'Active',    completion:65 },
  { id:2, name:'Batch B — Equipment',     prog:'Equipment Operation',      start:'Apr 5, 2026',  end:'May 15, 2026',  trainer:'Nadia K.', trainees:8,  st:'Active',    completion:40 },
  { id:3, name:'Batch C — Compliance',    prog:'Compliance & Legal',       start:'Mar 15, 2026', end:'Apr 15, 2026',  trainer:'Sara A.',  trainees:15, st:'Completed', completion:100 },
  { id:4, name:'Batch D — Leadership',    prog:'Leadership Development',   start:'Apr 10, 2026', end:'May 20, 2026',  trainer:'James O.', trainees:6,  st:'Active',    completion:25 },
  { id:5, name:'Batch E — Tech Skills',   prog:'Tech Skills',              start:'Mar 1, 2026',  end:'Mar 31, 2026',  trainer:'Nadia K.', trainees:10, st:'Completed', completion:100 },
  { id:6, name:'Batch F — On Hold',       prog:'Gold Safety Essentials',  start:'May 1, 2026',  end:'May 31, 2026',  trainer:'TBD',      trainees:0,  st:'On Hold',   completion:0 },
]

const INIT_ATTENDANCE = [
  { sess:'Gold Safety — Module 1', date:'Apr 13', batch:'Batch A', present:10, absent:2, late:1, total:12 },
  { sess:'Tech Skills — Excel',    date:'Apr 10', batch:'Batch E', present:9,  absent:1, late:0, total:10 },
  { sess:'Compliance Basics',      date:'Apr 5',  batch:'Batch C', present:12, absent:2, late:1, total:15 },
  { sess:'Safety Drill',           date:'Apr 8',  batch:'Batch A', present:7,  absent:5, late:0, total:12 },
]

const INIT_RESOURCES = [
  { id:1, name:'Gold Safety Handbook v2.pdf',          prog:'Gold Safety Essentials',  type:'PDF',      by:'Nadia K.', date:'Apr 1, 2026',  views:28 },
  { id:2, name:'Equipment Operation Manual v1.pdf',    prog:'Equipment Operation',      type:'PDF',      by:'James O.', date:'Mar 20, 2026', views:14 },
  { id:3, name:'Compliance Guidelines 2026.pdf',       prog:'Compliance & Legal',       type:'PDF',      by:'Sara A.',  date:'Feb 15, 2026', views:22 },
  { id:4, name:'Leadership Skills — Video Tutorial',   prog:'Leadership Development',   type:'Video',    by:'Nadia K.', date:'Apr 5, 2026',  views:9  },
  { id:5, name:'Excel Advanced Techniques.xlsx',       prog:'Tech Skills',              type:'Document', by:'Nadia K.', date:'Mar 2, 2026',  views:31 },
  { id:6, name:'Safety Drill Checklist v2.pdf',        prog:'Gold Safety Essentials',  type:'PDF',      by:'James O.', date:'Apr 10, 2026', views:6  },
]

const INIT_ASSESSMENTS = [
  { trainee:'Ahmad Yusuf',    prog:'Gold Safety Essentials',  score:88, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Zara Malik',     prog:'Gold Safety Essentials',  score:94, pass:true,  date:'Apr 13, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:62, pass:false, date:'Apr 13, 2026', attempt:1 },
  { trainee:'Nadia Khan',     prog:'Compliance & Legal',      score:97, pass:true,  date:'Apr 10, 2026', attempt:1 },
  { trainee:'Layla Siddiqui', prog:'Tech Skills',             score:76, pass:true,  date:'Mar 28, 2026', attempt:1 },
  { trainee:'Bilal Raza',     prog:'Equipment Operation',     score:55, pass:false, date:'Apr 14, 2026', attempt:1 },
  { trainee:'Hassan Ali',     prog:'Gold Safety Essentials',  score:74, pass:true,  date:'Apr 20, 2026', attempt:2 },
]

const INIT_CERTS = [
  { trainee:'Ahmad Yusuf',    cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_ahmad_gs1.pdf' },
  { trainee:'Zara Malik',     cert:'Gold Safety Level 1',       issued:'Apr 14, 2026', expiry:'Apr 14, 2028', st:'Issued',  doc:'cert_zara_gs1.pdf' },
  { trainee:'Nadia Khan',     cert:'Compliance Officer Cert',   issued:'Apr 10, 2026', expiry:'Apr 10, 2027', st:'Issued',  doc:'cert_nadia_compliance.pdf' },
  { trainee:'Layla Siddiqui', cert:'Tech Skills Certificate',   issued:'Mar 30, 2026', expiry:'Mar 30, 2028', st:'Issued',  doc:'cert_layla_tech.pdf' },
  { trainee:'Hassan Ali',     cert:'Gold Safety Level 1',       issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Bilal Raza',     cert:'Equipment Operator Cert',   issued:'—',            expiry:'—',            st:'Pending', doc:'—' },
  { trainee:'Omar Khan',      cert:'Leadership Certificate',    issued:'Jan 15, 2025', expiry:'Jan 15, 2026', st:'Expired', doc:'cert_omar_leadership.pdf' },
]

const INIT_FEEDBACK = [
  { trainer:'James O.', trainee:'Ahmad Yusuf',    session:'Gold Safety — Module 1', trainerRating:5, contentRating:4, venueRating:4, comment:'Very well explained. Practical examples were excellent.' },
  { trainer:'James O.', trainee:'Zara Malik',     session:'Gold Safety — Module 1', trainerRating:5, contentRating:5, venueRating:3, comment:'Great trainer. Room was a bit cold but content was perfect.' },
  { trainer:'Nadia K.', trainee:'Layla Siddiqui', session:'Tech Skills — Excel',    trainerRating:4, contentRating:5, venueRating:5, comment:'Online session was smooth. Loved the hands-on exercises.' },
  { trainer:'Sara A.',  trainee:'Nadia Khan',     session:'Compliance Basics',      trainerRating:4, contentRating:4, venueRating:4, comment:'Covered all the key regulations. Could use more case studies.' },
]

const INIT_TRAINEES = [
  { name:'Ahmad Yusuf',    dept:'Production', role:'Line Operator', email:'ahmad@ops.kz',  prog:['Gold Safety Essentials'],                       att:83,  certs:1 },
  { name:'Zara Malik',     dept:'Quality',    role:'Inspector',     email:'zara@ops.kz',   prog:['Gold Safety Essentials'],                       att:100, certs:1 },
  { name:'Hassan Ali',     dept:'Production', role:'Line Operator', email:'hassan@ops.kz', prog:['Gold Safety Essentials'],                       att:58,  certs:0 },
  { name:'Nadia Khan',     dept:'Training',   role:'Trainer',       email:'nadia@ops.kz',  prog:['Compliance & Legal','Leadership Development'],  att:92,  certs:1 },
  { name:'Layla Siddiqui', dept:'Sales',      role:'Sales Rep',     email:'layla@ops.kz',  prog:['Tech Skills'],                                  att:90,  certs:1 },
  { name:'Bilal Raza',     dept:'Operations', role:'Logistics',     email:'bilal@ops.kz',  prog:['Equipment Operation'],                          att:75,  certs:0 },
  { name:'Omar Khan',      dept:'Operations', role:'Ops Head',      email:'omar@ops.kz',   prog:['Leadership Development'],                       att:88,  certs:0 },
]

const SKILL_GAPS = [
  { dept:'Production',  skill:'Gold Processing Safety',       required:'Advanced',     current:'Basic',        gap:60, prog:'Gold Safety Essentials' },
  { dept:'Production',  skill:'Equipment Operation',          required:'Intermediate', current:'Basic',        gap:45, prog:'Equipment Operation' },
  { dept:'Operations',  skill:'Logistics Compliance',         required:'Advanced',     current:'Intermediate', gap:30, prog:'Compliance & Legal' },
  { dept:'HR',          skill:'HR Digital Tools',             required:'Advanced',     current:'Beginner',     gap:70, prog:'Tech Skills' },
  { dept:'Finance',     skill:'Advanced Excel & Reporting',   required:'Advanced',     current:'Intermediate', gap:25, prog:'Tech Skills' },
  { dept:'Sales',       skill:'Contract Negotiation',         required:'Expert',       current:'Intermediate', gap:50, prog:'Leadership Development' },
  { dept:'Compliance',  skill:'Regulatory Updates 2026',      required:'Expert',       current:'Advanced',     gap:15, prog:'Compliance & Legal' },
  { dept:'Training',    skill:'Digital Training Delivery',    required:'Advanced',     current:'Intermediate', gap:20, prog:'Tech Skills' },
]

const INIT_NOTIFS = [
  { id:'TN1', lv:'red',    read:false, title:'🔴 Overdue Task — Hassan Ali Assessment Retest',    desc:'Hassan Ali failed Gold Safety assessment. Retest scheduled but not yet completed. Due Apr 16.' },
  { id:'TN2', lv:'yellow', read:false, title:'🟡 Session Tomorrow — Equipment Operation (10:30)', desc:'Batch B session scheduled for Apr 14 at 10:30 on Site Floor. Trainer: Nadia K.' },
  { id:'TN3', lv:'orange', read:false, title:'🟠 Certificate Expiring — Omar Khan Leadership',    desc:"Omar Khan's Leadership Certificate expired Jan 2026. Renewal required immediately." },
  { id:'TN4', lv:'green',  read:false, title:'🟢 New Enrollment — Bilal Raza (Equipment Op.)',   desc:'Bilal Raza has been enrolled in Equipment Operation — Batch B starting Apr 5.' },
  { id:'TN5', lv:'red',    read:true,  title:'🔴 Low Attendance — Hassan Ali (58%)',              desc:'Hassan Ali attendance has dropped to 58% in Gold Safety. Minimum required: 75%.' },
  { id:'TN6', lv:'cyan',   read:true,  title:'🔵 Batch C Completed — Compliance & Legal',        desc:'All 15 trainees in Batch C have completed the Compliance & Legal program. Reports available.' },
]

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

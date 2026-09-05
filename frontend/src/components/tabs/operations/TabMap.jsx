import { OPS_C as C } from './operationsTabTokens'
import { SH, Restrict } from './operationsTabUI'

export default function TabMap({ canEdit: _canEdit, isAdmin, isHead, isExternal, showToast }) {
  if (isExternal) return <Restrict text="Live Operations Map is restricted." />
  const showGold = isAdmin || isHead

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Live Operations Map" sub={showGold ? 'Full view — all pins visible' : 'Routes and logistics view'} />
      <div style={{ background:'#f0faf5', borderRadius:10, minHeight:340, position:'relative', overflow:'hidden', border:`1px solid ${C.border}` }}>
        {/* Grid overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(var(--purple-rgb),.05) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--purple-rgb),.05) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
        {/* Route lines */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}>
          <line x1="15%" y1="30%" x2="55%" y2="65%" stroke="rgba(0,200,150,.5)"  strokeWidth="2" strokeDasharray="6 3" />
          <line x1="20%" y1="48%" x2="55%" y2="65%" stroke="rgba(255,214,0,.4)"  strokeWidth="2" strokeDasharray="6 3" />
          <line x1="18%" y1="22%" x2="55%" y2="65%" stroke="rgba(0,180,216,.5)"  strokeWidth="2" strokeDasharray="4 4" />
          <line x1="50%" y1="16%" x2="55%" y2="65%" stroke="rgba(255,71,87,.4)"  strokeWidth="2" strokeDasharray="6 3" />
        </svg>
        {/* Site Alpha */}
        <MapPin x="55%" y="65%" onClick={() => showToast('Site Alpha','Main production site — all routes terminate here')}>
          <div style={{ width:16, height:16, borderRadius:'50%', background:'var(--purple)', border:'2px solid #fff', boxShadow:'0 0 10px var(--purple)' }} />
          <div style={{ fontSize:10, color:'#fff', marginTop:3, fontWeight:700, textShadow:'0 1px 3px #000', whiteSpace:'nowrap' }}>🏭 Site Alpha</div>
        </MapPin>
        {/* Almaty */}
        <MapPin x="15%" y="30%" onClick={() => showToast('Almaty Hub','Route KAZ-1 origin — Primary road corridor')}>
          <PingDot color={C.green} /><div style={{ fontSize:9, color:C.green, marginTop:2, fontWeight:700 }}>📍 Almaty</div>
        </MapPin>
        {/* Airport */}
        <MapPin x="18%" y="22%" onClick={() => showToast('Almaty Airport','Route AIR-1 — High-value cargo only')}>
          <PingDot color={C.cyan} /><div style={{ fontSize:9, color:C.cyan, marginTop:2, fontWeight:700 }}>✈️ Airport</div>
        </MapPin>
        {/* Shymkent */}
        <MapPin x="20%" y="48%" onClick={() => showToast('Shymkent','Route KAZ-2 — Alternate road route (On Hold)')}>
          <PingDot color={C.yellow} /><div style={{ fontSize:9, color:C.yellow, marginTop:2, fontWeight:700 }}>📍 Shymkent</div>
        </MapPin>
        {/* Security checkpoints */}
        <MapPin x="38%" y="50%" onClick={() => showToast('Checkpoint Alpha-3','Security checkpoint — km 240 on KAZ-1. Armed escort beyond this point.')}>
          <div style={{ width:12, height:12, background:C.orange, borderRadius:3, border:'2px solid #fff' }} />
          <div style={{ fontSize:9, color:C.orange, marginTop:2, fontWeight:700 }}>🔐 CP-A3</div>
        </MapPin>
        <MapPin x="28%" y="39%" onClick={() => showToast('Checkpoint Alpha-2','Security checkpoint KAZ-1')}>
          <div style={{ width:10, height:10, background:C.orange, borderRadius:3, border:'1.5px solid rgba(255,255,255,.6)' }} />
          <div style={{ fontSize:8, color:C.orange, marginTop:2 }}>🔐 CP-A2</div>
        </MapPin>
        {/* Gold channels */}
        {showGold && <>
          <MapPin x="72%" y="26%" onClick={() => showToast('GS-001','Altyn Partners — East KZ. Contract Active. 80% volume attainment.')}>
            <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(245,158,11,.3)', border:`2px solid ${C.gold}` }} />
            <div style={{ fontSize:9, color:C.gold, marginTop:2, fontWeight:700 }}>🥇 GS-001</div>
          </MapPin>
          <MapPin x="60%" y="20%" onClick={() => showToast('GS-002','Northern Highlands — Final Negotiation. Volume: 52/80kg target.')}>
            <div style={{ width:12, height:12, borderRadius:'50%', background:'rgba(245,158,11,.2)', border:`2px solid rgba(245,158,11,.6)` }} />
            <div style={{ fontSize:9, color:C.gold, marginTop:2 }}>🥇 GS-002</div>
          </MapPin>
          <MapPin x="65%" y="42%" onClick={() => showToast('GS-003','KazGold Network — Central KZ. MoU stage. 18/50kg.')}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(245,158,11,.15)', border:`2px solid rgba(245,158,11,.4)` }} />
            <div style={{ fontSize:8, color:'rgba(245,158,11,.7)', marginTop:2 }}>🥇 GS-003</div>
          </MapPin>
        </>}
        {/* Legend */}
        <div style={{ position:'absolute', bottom:12, left:12, background:'rgba(30,30,53,.9)', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.t2, marginBottom:8 }}>Legend</div>
          {[['Active Route',C.green,'circle'],['On Hold',C.yellow,'circle'],['Suspended',C.red,'circle'],['Security Checkpoint',C.orange,'square'],...(showGold?[['Gold Channel',C.gold,'circle']]:[]),['Main Site','var(--purple)','circle']].map(([lbl,col,shape]) => (
            <div key={lbl} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.t2, marginBottom:4 }}>
              <div style={{ width:8, height:8, borderRadius: shape==='circle'?'50%':3, background:col, flexShrink:0 }} />
              {lbl}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function MapPin({ x, y, onClick, children }) {
  return (
    <div onClick={onClick} style={{ position:'absolute', left:x, top:y, transform:'translate(-50%,-50%)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center' }}>
      {children}
    </div>
  )
}
function PingDot({ color }) {
  return <div style={{ width:12, height:12, borderRadius:'50%', border:`2px solid ${color}`, background:`${color}30` }} />
}

// ─── TAB: Analytics ─────────────────────────────────────────────────────────────

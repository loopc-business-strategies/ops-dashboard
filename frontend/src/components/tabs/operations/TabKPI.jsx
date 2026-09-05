import { OPS_C as C } from './operationsTabTokens'
import { B, Badge, ProgBar, ProgRow, StatCard, Card, CardTitle, SH, Restrict } from './operationsTabUI'
import { opsPct as pct } from './operationsSeedData'

export default function TabKPI({ suppliers, gold: _gold, routes, incidents, vendors, inventory, canEdit: _canEdit, isAdmin, isHead, isMgmt }) {
  if (!isAdmin && !isHead && !isMgmt) return <Restrict text="KPI overview is not available to this role. Contact your Operations manager." />
  const done    = suppliers.filter(s => s.st === 'Completed').length
  const active  = routes.filter(r => r.st === 'Active').length
  const expiring= vendors.filter(v => v.days && v.days < 60).length
  const pending = suppliers.filter(s => s.st === 'Pending External' || s.st === 'In Progress').length
  const unresolved = incidents.filter(i => i.st !== 'Resolved').length
  const readiness = Math.round((
    pct(done, suppliers.length) +
    pct(routes.filter(r=>r.st==='Active').length, routes.length) +
    pct(vendors.filter(v=>v.signed==='Yes').length, vendors.length)
  ) / 3)
  const readColor = readiness >= 80 ? C.green : readiness >= 60 ? C.yellow : C.red

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <SH title="Operations KPI Overview" sub="Real-time operational status — all departments">
        <button style={B.ghost}>⬇ Export</button>
      </SH>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Operational Readiness" value={<span style={{ color:readColor }}>{readiness}%</span>} sub={<ProgBar pct={readiness} color={C.gbar} />} />
        <StatCard label="Active Suppliers" value={<span style={{ color:C.cyan }}>{suppliers.filter(s=>s.st!=='Not Started').length}</span>} sub={`${suppliers.length} total registered`} dot={C.cyan} />
        <StatCard label="Routes Active / Total" value={<><span style={{ color:C.green }}>{active}</span><span style={{ fontSize:16, color:C.t3 }}> / {routes.length}</span></>} sub={routes.filter(r=>r.st!=='Active').map(r=>r.name.split(' ')[1]).join(', ') + ' on hold'} dot={active >= 3 ? C.green : C.yellow} />
        <StatCard label="Security Incidents" value={<span style={{ color: unresolved > 0 ? C.red : C.green }}>{incidents.length}</span>} sub={`${unresolved} unresolved`} dot={C.red} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:11 }}>
        <StatCard label="Contracts Expiring Soon" value={<span style={{ color: expiring > 0 ? C.orange : C.green }}>{expiring}</span>} sub="Within 60 days" dot={C.orange} />
        <StatCard label="Pending Deliveries" value={<span style={{ color:C.yellow }}>{pending}</span>} sub="Awaiting delivery" dot={C.yellow} />
        {isAdmin || isHead
          ? <StatCard label="Gold Sourced This Month" value={<span style={{ color:C.gold }}>96 kg</span>} sub="Target: 120 kg" dot={C.gold} />
          : <StatCard label="Gold Sourced" value={<span style={{ color:C.t4 }}>••</span>} sub="Restricted" />}
        <StatCard label="Vendor Compliance Rate" value={<span style={{ color:C.green }}>83%</span>} sub="5 of 6 vendors compliant" dot={C.green} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Supply Chain Status by Category</CardTitle>
          {['Machinery','Chemicals','Consumables'].map(cat => {
            const items = suppliers.filter(s => s.cat === cat)
            const d = items.filter(s => s.st === 'Completed').length
            return <ProgRow key={cat} label={`${cat} (${items.length})`} p={pct(d, items.length || 1)} color={C.gbar} />
          })}
        </Card>
        <Card>
          <CardTitle>Route Status Overview</CardTitle>
          {routes.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <div style={{ fontWeight:600, color:C.t1 }}>{r.name.split('(')[0].trim()}</div>
              <div style={{ display:'flex', gap:6 }}><Badge s={r.mode} /><Badge s={r.st} /></div>
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Card>
          <CardTitle>Inventory Alert Summary</CardTitle>
          {inventory.map(i => (
            <div key={i.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <div style={{ color:C.t2 }}>{i.item}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:700, color: i.stock === 0 ? C.red : i.stock <= i.min ? C.yellow : C.green }}>{i.stock} units</span>
                <Badge s={i.st} />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>Vendor Contract Expiry</CardTitle>
          {vendors.filter(v => v.days).sort((a,b) => a.days - b.days).slice(0,5).map(v => {
            const col = v.days < 60 ? C.red : v.days < 120 ? C.yellow : C.green
            return (
              <div key={v.id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:C.t2, fontWeight:600 }}>{v.name}</span>
                  <span style={{ color:col, fontWeight:700 }}>{v.days}d</span>
                </div>
                <ProgBar pct={Math.min(v.days / 365 * 100, 100)} color={col} height={6} />
              </div>
            )
          })}
        </Card>
      </div>
    </div>
  )
}

// ─── TAB: Readiness Checklist ───────────────────────────────────────────────────

import { OPS_C as C } from './operationsTabTokens'
import { Badge, ProgBar, ProgRow, StatCard, Card, CardTitle, SH, Restrict } from './operationsTabUI'
import { opsPct as pct } from './operationsSeedData'

function EmptyBlock({ title, message }) {
  return (
    <div style={{
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: '18px 14px',
      textAlign: 'center',
      background: 'rgba(0,0,0,0.02)',
    }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{title}</div>
      {message ? <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{message}</div> : null}
    </div>
  )
}

export default function TabKPI({
  suppliers = [],
  gold = [],
  routes = [],
  incidents = [],
  vendors = [],
  inventory = [],
  tasks = [],
  checklist = [],
  canEdit,
  isAdmin,
  isHead,
  isMgmt,
  setModal,
}) {
  if (!isAdmin && !isHead && !isMgmt) {
    return <Restrict text="KPI overview is not available to this role. Contact your Operations manager." />
  }

  const done = suppliers.filter((s) => s.st === 'Completed').length
  const active = routes.filter((r) => r.st === 'Active').length
  const expiring = vendors.filter((v) => v.days != null && v.days < 60).length
  const pending = suppliers.filter((s) => s.st === 'Pending External' || s.st === 'In Progress').length
  const unresolved = incidents.filter((i) => i.st !== 'Resolved').length
  const inventoryAlerts = inventory.filter((i) => i.st === 'Critical' || i.st === 'Low Stock' || i.stock === 0)
  const openTasks = tasks.filter((t) => t.st !== 'Done' && t.st !== 'done' && t.status !== 'done')
  const checklistBlocked = checklist.filter((c) => c.st === 'Blocked' || c.st === 'In Progress')

  const goldActual = gold.reduce((sum, g) => sum + (Number(g.actual) || 0), 0)
  const goldTarget = gold.reduce((sum, g) => sum + (Number(g.vol) || 0), 0)
  const compliantVendors = vendors.filter((v) => v.signed === 'Yes').length

  const readinessParts = []
  if (suppliers.length) readinessParts.push(pct(done, suppliers.length))
  if (routes.length) readinessParts.push(pct(active, routes.length))
  if (vendors.length) readinessParts.push(pct(compliantVendors, vendors.length))
  const readiness = readinessParts.length
    ? Math.round(readinessParts.reduce((a, b) => a + b, 0) / readinessParts.length)
    : null
  const readColor = readiness == null ? C.t3 : readiness >= 80 ? C.green : readiness >= 60 ? C.yellow : C.red

  const attentionItems = [
    ...unresolved
      ? [{ id: 'inc', label: `${unresolved} unresolved security incident${unresolved === 1 ? '' : 's'}`, tone: C.red }]
      : [],
    ...expiring
      ? [{ id: 'exp', label: `${expiring} contract${expiring === 1 ? '' : 's'} expiring within 60 days`, tone: C.orange }]
      : [],
    ...inventoryAlerts.length
      ? [{ id: 'inv', label: `${inventoryAlerts.length} inventory item${inventoryAlerts.length === 1 ? '' : 's'} need attention`, tone: C.yellow }]
      : [],
    ...pending
      ? [{ id: 'del', label: `${pending} pending supplier delivery${pending === 1 ? '' : 'ies'}`, tone: C.yellow }]
      : [],
    ...checklistBlocked.slice(0, 3).map((c, idx) => ({
      id: `chk-${idx}`,
      label: c.item || 'Checklist item',
      tone: c.st === 'Blocked' ? C.red : C.yellow,
    })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SH title="Operations Overview" sub="Operational status from live records — no demo metrics">
        {canEdit ? (
          <button
            type="button"
            onClick={() => setModal?.({ type: 'incident-add', data: null })}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.inp,
              color: C.t1,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Log Incident
          </button>
        ) : null}
      </SH>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11 }}>
        <StatCard
          label="Operational Readiness"
          value={readiness == null ? <span style={{ color: C.t3 }}>—</span> : <span style={{ color: readColor }}>{readiness}%</span>}
          sub={readiness == null
            ? 'Add suppliers, routes, or vendors to calculate'
            : <ProgBar pct={readiness} color={C.gbar} />}
        />
        <StatCard
          label="Active Suppliers"
          value={<span style={{ color: C.cyan }}>{suppliers.filter((s) => s.st !== 'Not Started').length}</span>}
          sub={`${suppliers.length} total registered`}
          dot={C.cyan}
        />
        <StatCard
          label="Routes Active / Total"
          value={(
            <>
              <span style={{ color: C.green }}>{active}</span>
              <span style={{ fontSize: 16, color: C.t3 }}> / {routes.length}</span>
            </>
          )}
          sub={routes.length ? `${routes.length - active} not active` : 'No routes recorded'}
          dot={active > 0 ? C.green : C.t3}
        />
        <StatCard
          label="Security Incidents"
          value={<span style={{ color: unresolved > 0 ? C.red : C.green }}>{incidents.length}</span>}
          sub={`${unresolved} unresolved`}
          dot={unresolved > 0 ? C.red : C.green}
        />
        <StatCard
          label="Contracts Expiring Soon"
          value={<span style={{ color: expiring > 0 ? C.orange : C.green }}>{expiring}</span>}
          sub="Within 60 days"
          dot={C.orange}
        />
        <StatCard
          label="Pending Deliveries"
          value={<span style={{ color: pending ? C.yellow : C.t3 }}>{pending}</span>}
          sub="Awaiting delivery"
          dot={C.yellow}
        />
        {(isAdmin || isHead) ? (
          <StatCard
            label="Gold Sourced"
            value={gold.length
              ? <span style={{ color: C.gold }}>{goldActual} kg</span>
              : <span style={{ color: C.t3 }}>—</span>}
            sub={goldTarget ? `Target: ${goldTarget} kg` : 'No gold channels recorded'}
            dot={C.gold}
          />
        ) : (
          <StatCard label="Gold Sourced" value={<span style={{ color: C.t4 }}>••</span>} sub="Restricted" />
        )}
        <StatCard
          label="Vendor Contracts Signed"
          value={vendors.length
            ? <span style={{ color: C.green }}>{compliantVendors}/{vendors.length}</span>
            : <span style={{ color: C.t3 }}>—</span>}
          sub={vendors.length ? 'Signed contracts' : 'No vendors recorded'}
          dot={C.green}
        />
        <StatCard
          label="Open Ops Projects"
          value={<span style={{ color: C.t1 }}>{openTasks.length}</span>}
          sub={`${tasks.length} total`}
          dot={C.cyan}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.8fr)', gap: 14 }}>
        <Card>
          <CardTitle>Attention Required</CardTitle>
          {attentionItems.length === 0 ? (
            <EmptyBlock title="No active alerts" message="You're all caught up on operational attention items." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.inp,
                    fontSize: 12,
                    color: C.t1,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.tone, flexShrink: 0 }} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Quick Actions</CardTitle>
          <div style={{ display: 'grid', gap: 8 }}>
            {canEdit ? (
              <>
                <button type="button" onClick={() => setModal?.({ type: 'supplier-add', data: null })} style={actionBtnStyle}>+ Add Supplier</button>
                <button type="button" onClick={() => setModal?.({ type: 'incident-add', data: null })} style={actionBtnStyle}>+ Log Incident</button>
                <button type="button" onClick={() => setModal?.({ type: 'project-add', data: null })} style={actionBtnStyle}>+ Ops Project</button>
              </>
            ) : (
              <EmptyBlock title="View only" message="Editing requires Operations Head or Super Admin." />
            )}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <CardTitle>Supply Chain by Category</CardTitle>
          {suppliers.length === 0 ? (
            <EmptyBlock title="No suppliers yet" message="Add suppliers from Supply Chain." />
          ) : (
            ['Machinery', 'Chemicals', 'Consumables'].map((cat) => {
              const items = suppliers.filter((s) => s.cat === cat)
              if (!items.length) return null
              const d = items.filter((s) => s.st === 'Completed').length
              return <ProgRow key={cat} label={`${cat} (${items.length})`} p={pct(d, items.length)} color={C.gbar} />
            })
          )}
        </Card>
        <Card>
          <CardTitle>Route Status</CardTitle>
          {routes.length === 0 ? (
            <EmptyBlock title="No routes yet" message="Add transport routes to track status." />
          ) : (
            routes.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: C.t1 }}>{String(r.name || '').split('(')[0].trim() || r.name}</div>
                <div style={{ display: 'flex', gap: 6 }}><Badge s={r.mode} /><Badge s={r.st} /></div>
              </div>
            ))
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <CardTitle>Inventory Alerts</CardTitle>
          {inventory.length === 0 ? (
            <EmptyBlock title="No inventory data" message="Inventory loads from the live API." />
          ) : inventoryAlerts.length === 0 ? (
            <EmptyBlock title="No inventory alerts" message="All tracked items are within thresholds." />
          ) : (
            inventoryAlerts.slice(0, 8).map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                <div style={{ color: C.t2 }}>{i.item}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: i.stock === 0 ? C.red : i.stock <= i.min ? C.yellow : C.green }}>{i.stock} {i.unit || 'units'}</span>
                  <Badge s={i.st} />
                </div>
              </div>
            ))
          )}
        </Card>
        <Card>
          <CardTitle>Vendor Contract Expiry</CardTitle>
          {vendors.filter((v) => v.days != null).length === 0 ? (
            <EmptyBlock title="No contract expiry data" message="Add vendors with expiry dates to track renewals." />
          ) : (
            vendors.filter((v) => v.days != null).sort((a, b) => a.days - b.days).slice(0, 5).map((v) => {
              const col = v.days < 60 ? C.red : v.days < 120 ? C.yellow : C.green
              return (
                <div key={v.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: C.t2, fontWeight: 600 }}>{v.name}</span>
                    <span style={{ color: col, fontWeight: 700 }}>{v.days}d</span>
                  </div>
                  <ProgBar pct={Math.max(5, Math.min(100, (v.days / 365) * 100))} color={col} />
                </div>
              )
            })
          )}
        </Card>
      </div>
    </div>
  )
}

const actionBtnStyle = {
  height: 36,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.inp,
  color: C.t1,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'left',
  padding: '0 12px',
}

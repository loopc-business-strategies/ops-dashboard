import { OPS_C as C } from './operationsTabTokens'
import { Card, CardTitle, SH, Restrict } from './operationsTabUI'
import { opsPct as pct } from './operationsSeedData'

function EmptyBlock({ title, message }) {
  return (
    <div style={{
      border: `1px dashed ${C.border}`,
      borderRadius: 10,
      padding: '20px 14px',
      textAlign: 'center',
      background: 'rgba(0,0,0,0.02)',
    }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{title}</div>
      {message ? <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{message}</div> : null}
    </div>
  )
}

export default function TabAnalytics({
  suppliers = [],
  gold = [],
  routes = [],
  incidents = [],
  vendors = [],
  inventory = [],
  isAdmin,
  isHead,
  isMgmt,
}) {
  if (!isAdmin && !isHead && !isMgmt) {
    return <Restrict text="Operations Analytics is restricted to Super Admin, Operations Head and Management." />
  }

  const done = suppliers.filter((s) => s.st === 'Completed').length
  const fulfillment = suppliers.length ? pct(done, suppliers.length) : null
  const goldActual = gold.reduce((sum, g) => sum + (Number(g.actual) || 0), 0)
  const goldTarget = gold.reduce((sum, g) => sum + (Number(g.vol) || 0), 0)
  const unresolved = incidents.filter((i) => i.st !== 'Resolved').length
  const activeRoutes = routes.filter((r) => r.st === 'Active').length
  const signedVendors = vendors.filter((v) => v.signed === 'Yes').length
  const lowStock = inventory.filter((i) => i.st === 'Critical' || i.st === 'Low Stock' || i.stock === 0).length

  const hasAny = suppliers.length || gold.length || routes.length || incidents.length || vendors.length || inventory.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH title="Operations Analytics" sub="Snapshot from current operational records (not historical demo trends)" />

      {!hasAny ? (
        <EmptyBlock
          title="No operational data available"
          message="Analytics will appear once suppliers, routes, inventory, or related records exist."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
          <Card>
            <CardTitle>Supply Completion</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.cyan }}>
              {fulfillment == null ? '—' : `${fulfillment}%`}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>{done}/{suppliers.length} completed</div>
          </Card>
          <Card>
            <CardTitle>Gold Volume</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>
              {gold.length ? `${goldActual} kg` : '—'}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>
              {goldTarget ? `Target ${goldTarget} kg` : 'No gold channels'}
            </div>
          </Card>
          <Card>
            <CardTitle>Active Routes</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>{activeRoutes}/{routes.length}</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>Currently active</div>
          </Card>
          <Card>
            <CardTitle>Open Incidents</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: unresolved ? C.red : C.green }}>{unresolved}</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>{incidents.length} total recorded</div>
          </Card>
          <Card>
            <CardTitle>Signed Vendors</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.t1 }}>{signedVendors}/{vendors.length}</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>Contracts signed</div>
          </Card>
          <Card>
            <CardTitle>Inventory Alerts</CardTitle>
            <div style={{ fontSize: 28, fontWeight: 700, color: lowStock ? C.yellow : C.green }}>{lowStock}</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>{inventory.length} items tracked</div>
          </Card>
        </div>
      )}
    </div>
  )
}

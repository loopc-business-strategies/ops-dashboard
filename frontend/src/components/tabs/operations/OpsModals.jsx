import { useState } from 'react'
import { OPS_C as C } from './operationsTabTokens'
import { ML, MI, MS, MTA, Modal, IS } from './operationsTabUI'

export function ModalSupplier({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', cat:'Machinery', od:'', ed:'', qty:'', st:'Not Started', notes:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Supplier' : 'Add Supplier'} sub={isEdit ? 'Update supplier information' : 'Register a new supply chain supplier'} onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Supplier'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Supplier Name</ML><MI value={f.name} onChange={s('name')} placeholder="Company name" /></div>
        <div><ML>Category</ML><MS value={f.cat} onChange={s('cat')}>{['Machinery','Raw Materials','Chemicals','Consumables','Services'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Order Date</ML><input type="date" value={f.od} onChange={s('od')} style={IS} /></div>
        <div><ML>Expected Delivery</ML><input type="date" value={f.ed} onChange={s('ed')} style={IS} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Qty Ordered</ML><MI value={f.qty} onChange={s('qty')} placeholder="e.g. 10 units" /></div>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Not Started','In Progress','Pending External','Completed'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Notes</ML><MTA value={f.notes} onChange={s('notes')} placeholder="Any notes..." />
    </Modal>
  )
}


export function ModalIncident({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, desc:initial.res||'' } : { route:'Route KAZ-1 (Primary)', sev:'High', type:'Route Breach', vendor:'SecureForce KZ', desc:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Incident' : 'Report Security Incident'} sub={isEdit ? 'Update incident record' : 'Log a new security incident on a transport route'} onClose={onClose} onSave={() => onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Submit Incident'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Route</ML><MS value={f.route} onChange={s('route')}>{['Route KAZ-1 (Primary)','Route KAZ-2 (Alternate)','Route AIR-1','Route RAIL-1'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Severity</ML><MS value={f.sev} onChange={s('sev')}>{['Critical','High','Medium','Low'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Incident Type</ML><MS value={f.type} onChange={s('type')}>{['Route Breach','Escort Delay','Unauthorized Access','Vehicle Breakdown','Documentation Issue'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Security Vendor</ML><MS value={f.vendor} onChange={s('vendor')}>{['SecureForce KZ','AlphaGuard Ltd','Internal'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Description</ML><MTA value={f.desc} onChange={s('desc')} placeholder="Describe what happened..." />
    </Modal>
  )
}

// ─── Extra Modals ──────────────────────────────────────────────────────────────

export function ModalGoldChannel({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, vol:String(initial.vol), actual:String(initial.actual) } : { name:'', region:'', vol:'', actual:'', stage:'Contract Signed', cst:'Active', comp:'No', officer:'', risk:'Low', nextAction:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Gold Channel' : 'Add Gold Channel'} sub="Confidential — gold sourcing channel" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Channel'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Channel Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Altyn Partners" /></div>
        <div><ML>Region</ML><MI value={f.region} onChange={s('region')} placeholder="e.g. East KZ" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Volume Target (kg)</ML><MI type="number" value={f.vol} onChange={s('vol')} placeholder="0" /></div>
        <div><ML>Actual Volume (kg)</ML><MI type="number" value={f.actual} onChange={s('actual')} placeholder="0" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Stage</ML><MS value={f.stage} onChange={s('stage')}>{['Contract Signed','Final Negotiation','MoU Stage','On Hold'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Contract Status</ML><MS value={f.cst} onChange={s('cst')}>{['Active','Pending','Draft','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Risk Level</ML><MS value={f.risk} onChange={s('risk')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Compliance</ML><MS value={f.comp} onChange={s('comp')}>{['Yes','No'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Officer</ML><MI value={f.officer} onChange={s('officer')} placeholder="Officer name" /></div>
        <div><ML>Next Action</ML><MI value={f.nextAction} onChange={s('nextAction')} placeholder="Next steps" /></div>
      </div>
    </Modal>
  )
}


export function ModalRoute({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { name:'', origin:'', dest:'', carrier:'', mode:'Road', eta:'', st:'Active', risk:'Low', notes:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Route' : 'Add Route'} sub="Transport route configuration" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Route'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Route Name</ML><MI value={f.name} onChange={s('name')} placeholder="e.g. Route KAZ-3" /></div>
        <div><ML>Mode</ML><MS value={f.mode} onChange={s('mode')}>{['Road','Air','Rail','Sea'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Origin</ML><MI value={f.origin} onChange={s('origin')} placeholder="Origin city/hub" /></div>
        <div><ML>Destination</ML><MI value={f.dest} onChange={s('dest')} placeholder="Destination" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Carrier</ML><MI value={f.carrier} onChange={s('carrier')} placeholder="Carrier name" /></div>
        <div><ML>ETA</ML><MI value={f.eta} onChange={s('eta')} placeholder="e.g. 6 hrs" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Status</ML><MS value={f.st} onChange={s('st')}>{['Active','On Hold','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Risk Level</ML><MS value={f.risk} onChange={s('risk')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Notes</ML><MTA value={f.notes} onChange={s('notes')} placeholder="Security notes, special instructions..." />
    </Modal>
  )
}


export function ModalSecVendor({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial } : { vendor:'', proto:'Pending Review', escort:'Pending', threat:'Medium', route:'', nextRev:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Security Vendor' : 'Add Security Vendor'} sub="Security vendor protocol and escort details" onClose={onClose} onSave={() => f.vendor.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Vendor'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Vendor Name</ML><MI value={f.vendor} onChange={s('vendor')} placeholder="Security company" /></div>
        <div><ML>Protocol Status</ML><MS value={f.proto} onChange={s('proto')}>{['Approved','Pending Review','Suspended'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Escort</ML><MS value={f.escort} onChange={s('escort')}>{['Yes','Pending','No'].map(o=><option key={o}>{o}</option>)}</MS></div>
        <div><ML>Threat Level</ML><MS value={f.threat} onChange={s('threat')}>{['Low','Medium','High'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Assigned Routes</ML><MI value={f.route} onChange={s('route')} placeholder="e.g. KAZ-1, AIR-1" /></div>
        <div><ML>Next Review Date</ML><input type="date" value={f.nextRev||''} onChange={s('nextRev')} style={IS} /></div>
      </div>
    </Modal>
  )
}


export function ModalVendor({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, rating:String(initial.rating||3) } : { name:'', svc:'', val:'', signed:'No', exp:'', terms:'Net 30', mgr:'', rating:'3', renewal:'Active' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Vendor' : 'Add Vendor'} sub="Vendor contract details" onClose={onClose} onSave={() => f.name.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Vendor'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Vendor Name</ML><MI value={f.name} onChange={s('name')} placeholder="Company name" /></div>
        <div><ML>Service</ML><MI value={f.svc} onChange={s('svc')} placeholder="e.g. Road Freight" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Contract Value</ML><MI value={f.val} onChange={s('val')} placeholder="e.g. $50,000" /></div>
        <div><ML>Signed</ML><MS value={f.signed} onChange={s('signed')}>{['Yes','No','Pending'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Expiry Date</ML><input type="date" value={f.exp||''} onChange={s('exp')} style={IS} /></div>
        <div><ML>Payment Terms</ML><MI value={f.terms} onChange={s('terms')} placeholder="e.g. Net 30" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Account Manager</ML><MI value={f.mgr} onChange={s('mgr')} placeholder="Name" /></div>
        <div><ML>Rating (1-5)</ML><MS value={f.rating} onChange={s('rating')}>{['1','2','3','4','5'].map(o=><option key={o}>{o}</option>)}</MS></div>
      </div>
      <ML>Renewal Status</ML><MS value={f.renewal} onChange={s('renewal')}>{['Active','Renewal Due','Under Negotiation'].map(o=><option key={o}>{o}</option>)}</MS>
    </Modal>
  )
}


export function ModalInventoryItem({ initial, onClose, onSave }) {
  const [f, setF] = useState(initial ? { ...initial, stock:String(initial.stock), min:String(initial.min) } : { item:'', stock:'0', min:'0', sup:'', last:'' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  const isEdit = !!initial
  return (
    <Modal title={isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'} sub="Stock item and supplier details" onClose={onClose} onSave={() => f.item.trim() && onSave(f)} saveLabel={isEdit ? 'Save Changes' : 'Add Item'}>
      <div><ML>Item Name</ML><MI value={f.item} onChange={s('item')} placeholder="Item description" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Current Stock (units)</ML><MI type="number" value={f.stock} onChange={s('stock')} min="0" /></div>
        <div><ML>Minimum Level (units)</ML><MI type="number" value={f.min} onChange={s('min')} min="0" /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Supplier</ML><MI value={f.sup} onChange={s('sup')} placeholder="Supplier name" /></div>
        <div><ML>Last Restocked</ML><input type="date" value={f.last||''} onChange={s('last')} style={IS} /></div>
      </div>
    </Modal>
  )
}


export function ModalChecklistItem({ onClose, onSave }) {
  const [f, setF] = useState({ item:'', assign:'', due:'', st:'In Progress' })
  const s = k => e => setF(p => ({...p,[k]:e.target.value}))
  return (
    <Modal title="Add Checklist Item" sub="Add a new readiness checklist item" onClose={onClose} onSave={() => f.item.trim() && onSave(f)} saveLabel="Add Item">
      <div><ML>Checklist Item</ML><MI value={f.item} onChange={s('item')} placeholder="Item description" /></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div><ML>Assigned To</ML><MI value={f.assign} onChange={s('assign')} placeholder="Team member" /></div>
        <div><ML>Due Date</ML><MI value={f.due} onChange={s('due')} placeholder="e.g. Apr 30" /></div>
      </div>
      <ML>Initial Status</ML><MS value={f.st} onChange={s('st')}>{['In Progress','Blocked','To Do'].map(o=><option key={o}>{o}</option>)}</MS>
    </Modal>
  )
}

// ─── Notifications Panel ────────────────────────────────────────────────────────

export function NotifPanel({ notifs, setNotifs, onClose }) {
  const unread = notifs.filter(n => !n.read).length
  const lvCfg = { crit:{ color:C.red, border:C.red }, high:{ color:C.orange, border:C.orange }, med:{ color:C.yellow, border:C.yellow }, suc:{ color:C.green, border:C.green } }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:890 }} />
      <div style={{ position:'fixed', top:0, right:0, width:390, height:'100vh', background:'#ffffff', borderLeft:`1px solid ${C.border2}`, zIndex:900, display:'flex', flexDirection:'column', boxShadow:'-8px 0 40px rgba(0,0,0,.15)' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8f9fa' }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.t1, display:'flex', alignItems:'center', gap:8 }}>
            🔔 Operations Alerts
            {unread > 0 && <span style={{ background:C.red, color:'#fff', fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>{unread} new</span>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.t3, fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {notifs.map(n => {
            const cf = lvCfg[n.lv] || lvCfg.med
            return (
              <div key={n.id} style={{ background:n.read?'rgba(255,255,255,.01)':'rgba(255,255,255,.03)', border:`1px solid rgba(255,255,255,.05)`, borderLeft:`3px solid ${cf.border}`, borderRadius:9, padding:'11px 13px', marginBottom:7, opacity:n.read?.5:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:cf.color, marginBottom:3 }}>{n.title}</div>
                <div style={{ fontSize:11, color:C.t3, lineHeight:1.5, marginBottom:6 }}>{n.desc}</div>
                <div style={{ fontSize:10, color:C.t4, marginBottom:8 }}>{n.time}</div>
                <div style={{ display:'flex', gap:5 }}>
                  {!n.read && <button onClick={() => setNotifs(p => p.map(x => x.id===n.id ? {...x,read:true} : x))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(0,200,150,.12)', color:C.green, fontFamily:'inherit' }}>✓ Acknowledge</button>}
                  <button onClick={() => setNotifs(p => p.filter(x => x.id !== n.id))} style={{ padding:'3px 10px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background:'rgba(255,255,255,.06)', color:C.t3, fontFamily:'inherit' }}>✕ Dismiss</button>
                </div>
              </div>
            )
          })}
          {!notifs.length && <div style={{ textAlign:'center', padding:40, color:C.t4 }}>🔔<br/>No alerts</div>}
        </div>
        <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.border}`, display:'flex', gap:7 }}>
          <button onClick={() => setNotifs(p => p.map(n => ({...n,read:true})))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:'none', background:C.grad, color:'#fff' }}>✓ Mark all read</button>
          <button onClick={() => setNotifs(p => p.filter(n => !n.read))} style={{ flex:1, padding:8, borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${C.border}`, background:'rgba(255,255,255,.06)', color:C.t3 }}>🗑 Clear read</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

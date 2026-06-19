export function getOpsTabs(t) {
  return [
    { id: 'kpi', label: `📊 ${t('kpiOverview')}` },
    { id: 'checklist', label: `✅ ${t('readiness')}` },
    { id: 'supply', label: `🏭 ${t('supplyChain')}` },
    { id: 'gold', label: `🥇 ${t('goldSourcing')}` },
    { id: 'routes', label: `🚛 ${t('transport')}` },
    { id: 'security', label: `🔒 ${t('security')}` },
    { id: 'vendors', label: `📄 ${t('contracts')}` },
    { id: 'inventory', label: `📦 ${t('inventory')}` },
    { id: 'legal-docs', label: `📑 ${t('opsLegalDocuments')}` },
    { id: 'map', label: `🗺️ ${t('liveMap')}` },
    { id: 'analytics', label: `📈 ${t('analytics')}` },
    { id: 'projects', label: `📋 ${t('opsProjectsNav')}` },
  ]
}

export function opsPct(v, t) {
  return Math.max(0, Math.min(100, Math.round((v / Math.max(t, 1)) * 100)))
}

export const INIT_SUPPLIERS = [
  { id: 1, name: 'SinoTech Ltd', cat: 'Machinery', od: 'Mar 12, 2025', ed: 'Apr 20, 2025', ad: 'Apr 25, 2025', qty: '3 units', qr: '3 units', pay: 'Fully Paid', qc: 'Passed', st: 'Completed', notes: 'Crusher delivered on time' },
  { id: 2, name: 'KazMach Co', cat: 'Machinery', od: 'Apr 5, 2025', ed: 'Apr 30, 2025', ad: '—', qty: '1 unit', qr: '0', pay: 'Advance Paid', qc: 'Pending', st: 'Pending External', notes: 'Conveyor belt in customs' },
  { id: 3, name: 'EuroEquip GmbH', cat: 'Machinery', od: '—', ed: 'Jun 15, 2025', ad: '—', qty: '1 unit', qr: '0', pay: 'Not Paid', qc: 'Pending', st: 'Not Started', notes: 'Refinery pump pending' },
  { id: 4, name: 'ChemEx Corp', cat: 'Chemicals', od: 'Apr 10, 2025', ed: 'Apr 28, 2025', ad: '—', qty: '500 kg', qr: '0', pay: 'Advance Paid', qc: 'Pending', st: 'In Progress', notes: 'Reagents in transit' },
  { id: 5, name: 'LocalSupply KZ', cat: 'Consumables', od: 'Apr 1, 2025', ed: 'Apr 10, 2025', ad: 'Apr 9, 2025', qty: 'Bulk', qr: 'Bulk', pay: 'Fully Paid', qc: 'Passed', st: 'Completed', notes: 'Site consumables delivered' },
]

export const INIT_GOLD = [
  { id: 1, code: 'GS-001', name: 'Altyn Partners (Confidential)', vol: 120, actual: 96, stage: 'Contract Signed', cst: 'Active', comp: 'Yes', officer: 'Omar K.', region: 'East KZ', risk: 'Low', lastAct: 'Apr 10, 2025', nextAction: 'Quarterly review call Apr 20' },
  { id: 2, code: 'GS-002', name: 'Northern Highlands Collective', vol: 80, actual: 52, stage: 'Final Negotiation', cst: 'Pending', comp: 'No', officer: 'Omar K.', region: 'North KZ', risk: 'Medium', lastAct: 'Apr 5, 2025', nextAction: 'Send contract draft by Apr 18' },
  { id: 3, code: 'GS-003', name: 'KazGold Artisanal Network', vol: 50, actual: 18, stage: 'MoU Stage', cst: 'Draft', comp: 'No', officer: 'Aidar B.', region: 'Central KZ', risk: 'Medium', lastAct: 'Mar 28, 2025', nextAction: 'MoU signing meeting Apr 22' },
  { id: 4, code: 'GS-004', name: 'CrossBorder Commodities', vol: 0, actual: 0, stage: 'On Hold', cst: 'Suspended', comp: 'No', officer: '—', region: 'South KZ', risk: 'High', lastAct: 'Feb 15, 2025', nextAction: 'Compliance review required' },
]

export const INIT_ROUTES = [
  { id: 1, name: 'Route KAZ-1 (Primary)', origin: 'Almaty', dest: 'Site Alpha', carrier: 'KazTrans LLC', mode: 'Road', eta: '6 hrs', st: 'Active', risk: 'Low', lastInc: 'None', insurance: 'Active', gps: 'Active', checkpoints: '4/4', notes: 'Armed escort after km 240' },
  { id: 2, name: 'Route KAZ-2 (Alternate)', origin: 'Shymkent', dest: 'Site Alpha', carrier: 'SteppeLogistics', mode: 'Road', eta: '9 hrs', st: 'On Hold', risk: 'Medium', lastInc: 'Mar 28', insurance: 'Active', gps: 'Inactive', checkpoints: '2/4', notes: 'Security clearance review' },
  { id: 3, name: 'Route AIR-1', origin: 'Almaty Airport', dest: 'Site Airstrip', carrier: 'KazAir Cargo', mode: 'Air', eta: '45 min', st: 'Active', risk: 'Low', lastInc: 'None', insurance: 'Active', gps: 'Active', checkpoints: '2/2', notes: 'High-value shipments only' },
  { id: 4, name: 'Route RAIL-1', origin: 'Astana Rail Hub', dest: 'Site Rail Siding', carrier: 'KTZ Freight', mode: 'Rail', eta: '18 hrs', st: 'Suspended', risk: 'High', lastInc: 'Apr 2', insurance: 'Active', gps: 'Inactive', checkpoints: '1/5', notes: 'Suspended — security review' },
]

export const INIT_SEC_VENDORS = [
  { id: 1, vendor: 'SecureForce KZ', proto: 'Approved', escort: 'Yes', lastRev: 'Apr 5, 2025', nextRev: 'Jul 5, 2025', incidents: 2, threat: 'Medium', route: 'KAZ-1, KAZ-2' },
  { id: 2, vendor: 'AlphaGuard Ltd', proto: 'Pending Review', escort: 'Pending', lastRev: 'Mar 15, 2025', nextRev: 'May 15, 2025', incidents: 0, threat: 'Low', route: 'AIR-1' },
]

export const INIT_INCIDENTS = [
  { id: 'INC-003', date: 'Apr 2, 2025', route: 'Route RAIL-1', vendor: 'Internal', type: 'Route Breach', sev: 'High', st: 'Under Investigation', res: 'Investigation ongoing' },
  { id: 'INC-002', date: 'Mar 28, 2025', route: 'Route KAZ-2', vendor: 'SecureForce KZ', type: 'Escort Delay', sev: 'Medium', st: 'Resolved', res: 'Escort breakdown resolved. Protocol updated.' },
  { id: 'INC-001', date: 'Mar 15, 2025', route: 'Route KAZ-1', vendor: 'Internal', type: 'Documentation Issue', sev: 'Low', st: 'Resolved', res: 'Customs paperwork corrected within 24hrs' },
]

export const INIT_VENDORS = [
  { id: 1, name: 'SecureForce KZ', svc: 'Armed Security', val: '$180,000', signed: 'Yes', exp: 'Dec 31, 2025', terms: 'Monthly', mgr: 'Omar K.', rating: 5, renewal: 'Active', days: 261 },
  { id: 2, name: 'KazTrans LLC', svc: 'Road Freight', val: '$95,000', signed: 'Yes', exp: 'Sep 30, 2025', terms: 'Per Shipment', mgr: 'Bilal R.', rating: 4, renewal: 'Renewal Due', days: 169 },
  { id: 3, name: 'ChemEx Corp', svc: 'Chemical Supply', val: '$42,000', signed: 'Yes', exp: 'Oct 15, 2025', terms: 'Net 30', mgr: 'Omar K.', rating: 3, renewal: 'Active', days: 184 },
  { id: 4, name: 'SteppeLogistics', svc: 'Alternate Freight', val: '$60,000', signed: 'No', exp: '—', terms: 'TBD', mgr: 'Bilal R.', rating: 2, renewal: 'Under Negotiation', days: null },
  { id: 5, name: 'AlphaGuard Ltd', svc: 'Security Backup', val: '$75,000', signed: 'Pending', exp: 'Nov 1, 2025', terms: 'Monthly', mgr: 'Omar K.', rating: 3, renewal: 'Active', days: 201 },
  { id: 6, name: 'KAZ Equipment Svc', svc: 'Maintenance', val: '$28,000', signed: 'Yes', exp: 'Aug 1, 2025', terms: 'Quarterly', mgr: 'Bilal R.', rating: 4, renewal: 'Renewal Due', days: 109 },
]

export const INIT_INVENTORY = [
  { id: 'INV-001', item: 'Drive Belt (Heavy)', stock: 2, min: 3, sup: 'KAZ Equipment Svc', last: 'Apr 13, 2025', st: 'Critical' },
  { id: 'INV-002', item: 'Filter Kit (Industrial)', stock: 8, min: 5, sup: 'ChemEx Corp', last: 'Apr 10, 2025', st: 'Sufficient' },
  { id: 'INV-003', item: 'Spindle Bearing Set', stock: 1, min: 2, sup: 'EuroEquip GmbH', last: 'Apr 3, 2025', st: 'Low Stock' },
  { id: 'INV-004', item: 'Lubricant Oil (5L)', stock: 12, min: 4, sup: 'LocalSupply KZ', last: 'Apr 12, 2025', st: 'Sufficient' },
  { id: 'INV-005', item: 'Processing Reagent', stock: 180, min: 200, sup: 'ChemEx Corp', last: 'Apr 8, 2025', st: 'Low Stock' },
  { id: 'INV-006', item: 'Safety Equipment Kit', stock: 0, min: 5, sup: 'LocalSupply KZ', last: 'Mar 20, 2025', st: 'Critical' },
]

export const INIT_CHECKLIST = [
  { item: 'Site Access Roads Secured', assign: 'Ahmad Y.', st: 'Done', due: 'Apr 5', by: 'Ahmad Y.', ts: 'Apr 5 09:00' },
  { item: 'Machinery Procurement Confirmed', assign: 'Omar K.', st: 'Done', due: 'Apr 8', by: 'Omar K.', ts: 'Apr 8 11:30' },
  { item: 'Security Vendor Contracts Signed', assign: 'Omar K.', st: 'Done', due: 'Apr 10', by: 'Omar K.', ts: 'Apr 10 14:00' },
  { item: 'Customs Clearance — All Equipment', assign: 'Bilal R.', st: 'In Progress', due: 'Apr 20', by: '—', ts: '—' },
  { item: 'Route KAZ-1 Safety Audit', assign: 'Ahmad Y.', st: 'Done', due: 'Apr 7', by: 'Ahmad Y.', ts: 'Apr 7 16:00' },
  { item: 'Inventory Minimum Levels Met', assign: 'Bilal R.', st: 'Blocked', due: 'Apr 16', by: '—', ts: '—' },
  { item: 'Gold Sourcing Channel Compliance', assign: 'Omar K.', st: 'In Progress', due: 'Apr 22', by: '—', ts: '—' },
  { item: 'Vendor Payment Schedules Confirmed', assign: 'Omar F.', st: 'Done', due: 'Apr 12', by: 'Omar F.', ts: 'Apr 12 10:00' },
  { item: 'Emergency Response Protocol Updated', assign: 'Ahmad Y.', st: 'In Progress', due: 'Apr 25', by: '—', ts: '—' },
  { item: 'Staff Safety Induction Completed', assign: 'Fatima N.', st: 'Done', due: 'Apr 10', by: 'Fatima N.', ts: 'Apr 10 09:00' },
  { item: 'Insurance Certificates Renewed', assign: 'Omar F.', st: 'Done', due: 'Apr 15', by: 'Omar F.', ts: 'Apr 14 15:30' },
]

export const INIT_NOTIFS = [
  { id: 'ON1', lv: 'crit', read: false, title: '🔴 Contract Expiring in 169 Days — KazTrans LLC', desc: 'KazTrans LLC contract expires Sep 30. Renewal process should start now.', time: 'Today' },
  { id: 'ON2', lv: 'high', read: false, title: '🟠 Security Review Overdue — Route RAIL-1', desc: 'Route RAIL-1 suspended. Security review was due Apr 10 and has not been completed.', time: '2 hrs ago' },
  { id: 'ON3', lv: 'crit', read: false, title: '🔴 Incident Reported — Route RAIL-1', desc: 'Route breach INC-003 reported Apr 2. Investigation ongoing. Escalation required.', time: '2 days ago' },
  { id: 'ON4', lv: 'med', read: false, title: '🟡 Delivery Overdue — KazMach Conveyor Belt', desc: 'KazMach Co conveyor belt expected Apr 30 but currently held at Almaty customs. Action needed.', time: 'Today' },
  { id: 'ON5', lv: 'med', read: false, title: '🟡 Gold Channel Compliance Issue — GS-002 & GS-003', desc: 'Two gold sourcing channels have incomplete compliance documentation. Review by Apr 22.', time: 'Yesterday' },
  { id: 'ON6', lv: 'suc', read: true, title: '🟢 New Delivery Confirmed — SinoTech Ltd', desc: 'Crusher Unit A from SinoTech Ltd delivered and accepted. Quality check passed.', time: 'Apr 10' },
  { id: 'ON7', lv: 'high', read: true, title: '🟠 GPS Inactive on Route KAZ-2', desc: 'GPS tracking is not active on Route KAZ-2. Security risk. Update required.', time: 'Apr 8' },
  { id: 'ON8', lv: 'crit', read: false, title: '🔴 Safety Equipment Kit — Stock Zero', desc: 'Safety Equipment Kit has zero stock. Minimum is 5 units. Immediate restock required.', time: 'Today' },
]

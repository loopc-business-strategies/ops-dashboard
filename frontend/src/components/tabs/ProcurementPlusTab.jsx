import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import erpUnified from '../../api/erpUnified'
import { ErpSubTabButton, ModulePageHeading, ModuleTabColumn } from '../layout/ModuleTabChrome'
import { useDashboardModuleSubTab } from '../../hooks/useDashboardModuleSubTab'

const C = {
  card: '#ffffff',
  border: '#E2E8F0',
  ink: '#0F172A',
  inkSoft: '#64748B',
  primary: 'var(--purple)',
}

const erpOps = erpUnified.operations

const TABS = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'orders', label: 'Purchase Orders' },
  { id: 'alerts', label: 'Expiry Alerts' },
]

function Card({ children, style }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>
}

function Btn({ children, onClick, disabled, variant = 'primary' }) {
  const style = variant === 'primary'
    ? { background: C.primary, color: '#fff', border: 'none' }
    : { background: '#fff', color: C.ink, border: `1px solid ${C.border}` }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...style, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit' }}
    />
  )
}

export default function ProcurementPlusTab() {
  const { token, company } = useAuth()
  const { isReadOnly } = usePermissions()
  const allowedSubIds = useMemo(() => TABS.map((tab) => tab.id), [])
  const { subTab: activeTab, buildSubHref, handleSubTabClick } = useDashboardModuleSubTab(
    'procurement-plus',
    allowedSubIds,
    'suppliers',
    company,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [alerts, setAlerts] = useState([])
  const [query, setQuery] = useState('')

  const [supplierForm, setSupplierForm] = useState({ name: '', country: '', contact: '', productType: '', paymentTerms: '' })
  const [poForm, setPoForm] = useState({ poNumber: '', supplierId: '', itemName: '', quantity: '', unitPrice: '', expectedDeliveryDate: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [supRes, poRes, alertRes] = await Promise.all([
        erpOps.getSuppliers(token),
        erpOps.getPurchaseOrders(token),
        erpOps.getExpiryAlerts(token),
      ])
      setSuppliers(Array.isArray(supRes?.suppliers) ? supRes.suppliers : (Array.isArray(supRes) ? supRes : []))
      setOrders(Array.isArray(poRes?.purchaseOrders) ? poRes.purchaseOrders : (Array.isArray(poRes) ? poRes : []))
      setAlerts(Array.isArray(alertRes?.alerts) ? alertRes.alerts : (Array.isArray(alertRes) ? alertRes : []))
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load procurement data')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { loadData() }, [loadData])

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => [s.name, s.country, s.contact, s.productType].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [suppliers, query])

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => [o.poNumber, o.status, o.supplierName].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [orders, query])

  const handleCreateSupplier = async () => {
    if (isReadOnly || !supplierForm.name.trim()) return
    try {
      await erpOps.createSupplier(token, supplierForm)
      setSupplierForm({ name: '', country: '', contact: '', productType: '', paymentTerms: '' })
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to create supplier')
    }
  }

  const handleCreatePo = async () => {
    if (isReadOnly || !poForm.poNumber.trim() || !poForm.supplierId) return
    try {
      await erpOps.createPurchaseOrder(token, {
        poNumber: poForm.poNumber.trim(),
        supplierId: poForm.supplierId,
        expectedDeliveryDate: poForm.expectedDeliveryDate || undefined,
        items: [{
          itemName: poForm.itemName || 'General item',
          quantity: Number(poForm.quantity || 0),
          unitPrice: Number(poForm.unitPrice || 0),
        }],
      })
      setPoForm({ poNumber: '', supplierId: '', itemName: '', quantity: '', unitPrice: '', expectedDeliveryDate: '' })
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to create purchase order')
    }
  }

  const handleResolveAlert = async (id) => {
    if (isReadOnly) return
    try {
      await erpOps.resolveExpiryAlert(token, id, 'Resolved from Procurement Plus')
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to resolve alert')
    }
  }

  return (
    <ModuleTabColumn>
      <ModulePageHeading
        title="Procurement Plus"
        subtitle="Suppliers, purchase orders, and expiry alerts via the operations ERP API."
        right={<span style={{ fontSize: 12, color: C.inkSoft }}>{loading ? 'Loading…' : `${suppliers.length} suppliers · ${orders.length} POs`}</span>}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((tab) => (
          <ErpSubTabButton
            key={tab.id}
            active={activeTab === tab.id}
            href={buildSubHref(tab.id)}
            onClick={(event) => handleSubTabClick(tab.id, event)}
          >
            {tab.label}
          </ErpSubTabButton>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
        </div>
        <Btn variant="secondary" onClick={loadData} disabled={loading}>Refresh</Btn>
      </div>

      {error && <Card style={{ borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C' }}>{error}</Card>}

      {activeTab === 'suppliers' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!isReadOnly && (
            <Card>
              <p style={{ margin: '0 0 10px', fontWeight: 700, color: C.ink }}>Add supplier</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <Input value={supplierForm.name} onChange={(e) => setSupplierForm((s) => ({ ...s, name: e.target.value }))} placeholder="Name *" />
                <Input value={supplierForm.country} onChange={(e) => setSupplierForm((s) => ({ ...s, country: e.target.value }))} placeholder="Country" />
                <Input value={supplierForm.contact} onChange={(e) => setSupplierForm((s) => ({ ...s, contact: e.target.value }))} placeholder="Contact" />
                <Input value={supplierForm.productType} onChange={(e) => setSupplierForm((s) => ({ ...s, productType: e.target.value }))} placeholder="Product type" />
                <Input value={supplierForm.paymentTerms} onChange={(e) => setSupplierForm((s) => ({ ...s, paymentTerms: e.target.value }))} placeholder="Payment terms" />
              </div>
              <div style={{ marginTop: 10 }}><Btn onClick={handleCreateSupplier}>Save supplier</Btn></div>
            </Card>
          )}
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.inkSoft }}>
                    <th style={{ padding: '6px 8px' }}>Name</th>
                    <th style={{ padding: '6px 8px' }}>Country</th>
                    <th style={{ padding: '6px 8px' }}>Contact</th>
                    <th style={{ padding: '6px 8px' }}>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => (
                    <tr key={s._id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px' }}>{s.name}</td>
                      <td style={{ padding: '8px' }}>{s.country || '—'}</td>
                      <td style={{ padding: '8px' }}>{s.contact || '—'}</td>
                      <td style={{ padding: '8px' }}>{s.productType || '—'}</td>
                    </tr>
                  ))}
                  {!filteredSuppliers.length && <tr><td colSpan={4} style={{ padding: 12, color: C.inkSoft }}>No suppliers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'orders' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {!isReadOnly && (
            <Card>
              <p style={{ margin: '0 0 10px', fontWeight: 700, color: C.ink }}>Create purchase order</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <Input value={poForm.poNumber} onChange={(e) => setPoForm((s) => ({ ...s, poNumber: e.target.value }))} placeholder="PO number *" />
                <select value={poForm.supplierId} onChange={(e) => setPoForm((s) => ({ ...s, supplierId: e.target.value }))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}>
                  <option value="">Supplier *</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                <Input value={poForm.itemName} onChange={(e) => setPoForm((s) => ({ ...s, itemName: e.target.value }))} placeholder="Item name" />
                <Input value={poForm.quantity} onChange={(e) => setPoForm((s) => ({ ...s, quantity: e.target.value }))} placeholder="Qty" type="number" />
                <Input value={poForm.unitPrice} onChange={(e) => setPoForm((s) => ({ ...s, unitPrice: e.target.value }))} placeholder="Unit price" type="number" />
                <Input value={poForm.expectedDeliveryDate} onChange={(e) => setPoForm((s) => ({ ...s, expectedDeliveryDate: e.target.value }))} placeholder="Expected delivery" type="date" />
              </div>
              <div style={{ marginTop: 10 }}><Btn onClick={handleCreatePo}>Create PO</Btn></div>
            </Card>
          )}
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: C.inkSoft }}>
                    <th style={{ padding: '6px 8px' }}>PO #</th>
                    <th style={{ padding: '6px 8px' }}>Supplier</th>
                    <th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o._id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '8px' }}>{o.poNumber}</td>
                      <td style={{ padding: '8px' }}>{o.supplierName || o.supplierId?.name || '—'}</td>
                      <td style={{ padding: '8px' }}>{o.status || 'draft'}</td>
                      <td style={{ padding: '8px' }}>{Number(o.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {!filteredOrders.length && <tr><td colSpan={4} style={{ padding: 12, color: C.inkSoft }}>No purchase orders found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.inkSoft }}>
                  <th style={{ padding: '6px 8px' }}>Item</th>
                  <th style={{ padding: '6px 8px' }}>Expiry</th>
                  <th style={{ padding: '6px 8px' }}>Status</th>
                  <th style={{ padding: '6px 8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a._id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px' }}>{a.itemName || a.title || a.reference || '—'}</td>
                    <td style={{ padding: '8px' }}>{a.expiryDate ? new Date(a.expiryDate).toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ padding: '8px' }}>{a.status || 'open'}</td>
                    <td style={{ padding: '8px' }}>
                      {!isReadOnly && a.status !== 'resolved' && (
                        <Btn variant="secondary" onClick={() => handleResolveAlert(a._id)}>Resolve</Btn>
                      )}
                    </td>
                  </tr>
                ))}
                {!alerts.length && <tr><td colSpan={4} style={{ padding: 12, color: C.inkSoft }}>No expiry alerts.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </ModuleTabColumn>
  )
}

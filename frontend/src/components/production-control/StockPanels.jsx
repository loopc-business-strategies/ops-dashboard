import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatTime } from './shared'
import { PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge } from './primitives'

const EMPTY_FORM = {
  purchaseRef: '',
  supplier: '',
  purchaseDate: '',
  product: '',
  productCode: '',
  category: '',
  designNumber: '',
  quantity: '',
  grossWeight: '',
  netWeight: '',
  metalType: 'Gold',
  purity: '22K',
  size: '',
  remarks: '',
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function StockOverviewPanel({ onToast, onNavigate }) {
  const pccApi = usePccApi()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await pccApi.getStockOverview()
        if (!cancelled) setOverview(data.overview || data)
      } catch (err) {
        onToast?.(err?.response?.data?.message || 'Failed to load stock overview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pccApi, onToast])

  if (loading && !overview) return <div className="pcc-panel"><PccSkeleton rows={4} /></div>

  const o = overview || {}
  return (
    <div className="pcc-stack">
      <div className="pcc-kpi-row">
        <PccKpiCard label="New Stock" value={o.newStock?.count ?? 0} hint={formatGrams(o.newStock?.weight)} />
        <PccKpiCard label="Available" value={o.available?.count ?? 0} hint={formatGrams(o.available?.weight)} />
        <PccKpiCard label="Selected" value={o.selected?.count ?? 0} />
        <PccKpiCard label="Under Processing" value={o.underProcessing?.count ?? 0} hint={formatGrams(o.underProcessing?.weight)} />
        <PccKpiCard label="Finished" value={o.finished?.count ?? 0} hint={formatGrams(o.finished?.weight)} />
        <PccKpiCard label="Dispatched" value={o.dispatched?.count ?? 0} />
      </div>
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>STOCK CONTROL</h2>
          <div className="pcc-row-actions">
            <button type="button" className="pcc-btn" onClick={() => onNavigate?.('stock-in')}>New Stock In</button>
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-selection')}>Select Stock</button>
          </div>
        </div>
        <p className="pcc-muted">Lot-level STK codes with full status history. ERP inventory remains independent.</p>
      </div>
    </div>
  )
}

function StockTable({ lots, onSelect, empty }) {
  if (!lots?.length) return <PccEmptyState message={empty || 'No stock lots'} />
  return (
    <div className="pcc-table-wrap">
      <table className="pcc-table">
        <thead>
          <tr>
            <th>Stock Code</th>
            <th>Product</th>
            <th>Qty</th>
            <th>Weight</th>
            <th>Status</th>
            <th>Supplier</th>
            <th>Batch</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot._id}>
              <td><strong>{lot.stockCode}</strong></td>
              <td>{lot.product || '—'}{lot.productCode ? ` · ${lot.productCode}` : ''}</td>
              <td>{lot.quantity ?? 0}</td>
              <td>{formatGrams(lot.netWeight || lot.grossWeight)}</td>
              <td><PccStatusBadge status={lot.status} /></td>
              <td>{lot.supplier || '—'}</td>
              <td>{lot.batchNumber || '—'}</td>
              <td>
                {onSelect && (
                  <button type="button" className="pcc-btn-ghost" onClick={() => onSelect(lot)}>Select</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StockListPanel({ title, statusFilter, onToast, selectable, onAllocated }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [lots, setLots] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const debounced = useDebounced(search)
  const [selectForm, setSelectForm] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await pccApi.listStock({
        status: statusFilter,
        search: debounced || undefined,
        limit: 50,
      })
      setLots(data.lots || [])
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load stock')
    } finally {
      setLoading(false)
    }
  }, [pccApi, statusFilter, debounced, onToast])

  useEffect(() => { load() }, [load])

  const allocate = async (e) => {
    e.preventDefault()
    if (!selectForm) return
    try {
      const res = await pccApi.selectStock({
        stockLotId: selectForm._id,
        quantity: selectForm.quantity !== '' ? Number(selectForm.quantity) : undefined,
        weight: selectForm.weight !== '' ? Number(selectForm.weight) : undefined,
        markIssued: Boolean(selectForm.markIssued),
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : `Batch ${res.batch?.batchNumber} created from ${res.lot?.stockCode}`)
      setSelectForm(null)
      onAllocated?.(res)
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Allocation failed')
    }
  }

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head">
        <h2>{title}</h2>
        <input
          className="pcc-input"
          placeholder="Search stock code, product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? <PccSkeleton rows={5} /> : (
        <StockTable
          lots={lots}
          empty={`No lots${statusFilter ? ` in ${statusFilter}` : ''}`}
          onSelect={selectable ? (lot) => setSelectForm({
            ...lot,
            quantity: lot.quantity || '',
            weight: lot.netWeight || lot.grossWeight || '',
            markIssued: false,
          }) : undefined}
        />
      )}
      {selectForm && (
        <form className="pcc-form pcc-form-inline" onSubmit={allocate} style={{ marginTop: 12 }}>
          <strong>Allocate {selectForm.stockCode}</strong>
          <label>
            Qty
            <input className="pcc-input" type="number" min="0" step="any" value={selectForm.quantity}
              onChange={(e) => setSelectForm((s) => ({ ...s, quantity: e.target.value }))} />
          </label>
          <label>
            Weight (g)
            <input className="pcc-input" type="number" min="0" step="any" value={selectForm.weight} required
              onChange={(e) => setSelectForm((s) => ({ ...s, weight: e.target.value }))} />
          </label>
          <label className="pcc-check">
            <input type="checkbox" checked={selectForm.markIssued}
              onChange={(e) => setSelectForm((s) => ({ ...s, markIssued: e.target.checked }))} />
            Mark issued
          </label>
          <button type="submit" className="pcc-btn">Create Batch</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => setSelectForm(null)}>Cancel</button>
        </form>
      )}
    </div>
  )
}

export function NewStockInPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await pccApi.createStock({
        ...form,
        quantity: Number(form.quantity) || 0,
        grossWeight: Number(form.grossWeight) || 0,
        netWeight: Number(form.netWeight) || Number(form.grossWeight) || 0,
        purchaseDate: form.purchaseDate || null,
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : `Created ${res.lot?.stockCode}`)
      setForm(EMPTY_FORM)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to create stock')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>NEW STOCK IN</h2></div>
      <form className="pcc-form" onSubmit={submit}>
        <div className="pcc-form-grid">
          <label>Purchase Ref<input className="pcc-input" value={form.purchaseRef} onChange={set('purchaseRef')} /></label>
          <label>Supplier<input className="pcc-input" value={form.supplier} onChange={set('supplier')} /></label>
          <label>Purchase Date<input className="pcc-input" type="date" value={form.purchaseDate} onChange={set('purchaseDate')} /></label>
          <label>Product<input className="pcc-input" value={form.product} onChange={set('product')} placeholder="e.g. Bangle 1" /></label>
          <label>Product Code<input className="pcc-input" value={form.productCode} onChange={set('productCode')} /></label>
          <label>Category<input className="pcc-input" value={form.category} onChange={set('category')} /></label>
          <label>Design Number<input className="pcc-input" value={form.designNumber} onChange={set('designNumber')} /></label>
          <label>Quantity<input className="pcc-input" type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} /></label>
          <label>Gross Weight (g)<input className="pcc-input" type="number" min="0" step="any" value={form.grossWeight} onChange={set('grossWeight')} /></label>
          <label>Net Weight (g)<input className="pcc-input" type="number" min="0" step="any" value={form.netWeight} onChange={set('netWeight')} /></label>
          <label>Metal
            <select className="pcc-input" value={form.metalType} onChange={set('metalType')}>
              <option>Gold</option><option>Silver</option><option>Platinum</option><option>Other</option>
            </select>
          </label>
          <label>Purity<input className="pcc-input" value={form.purity} onChange={set('purity')} /></label>
          <label>Size<input className="pcc-input" value={form.size} onChange={set('size')} /></label>
          <label>Remarks<input className="pcc-input" value={form.remarks} onChange={set('remarks')} /></label>
        </div>
        <p className="pcc-muted">Stock code is assigned automatically (STK-YYYY-#####). Initial status: NEW_STOCK.</p>
        <button type="submit" className="pcc-btn" disabled={saving}>{saving ? 'Saving…' : 'Create Stock'}</button>
      </form>
    </div>
  )
}

export function StockHistoryPanel({ onToast }) {
  const pccApi = usePccApi()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await pccApi.getStockHistory({ limit: 100 })
        if (!cancelled) setEvents(data.events || [])
      } catch (err) {
        onToast?.(err?.response?.data?.message || 'Failed to load stock history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pccApi, onToast])

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>STOCK HISTORY</h2></div>
      {loading ? <PccSkeleton rows={5} /> : !events.length ? (
        <PccEmptyState message="No stock status events yet" />
      ) : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead>
              <tr>
                <th>When</th><th>Stock</th><th>From</th><th>To</th><th>User</th><th>Reason</th><th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id}>
                  <td>{formatTime(e.createdAt)}</td>
                  <td>{e.stockCode}</td>
                  <td>{e.fromStatus || '—'}</td>
                  <td><PccStatusBadge status={e.toStatus} /></td>
                  <td>{e.actorName}</td>
                  <td>{e.reason || '—'}</td>
                  <td>{e.batchNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function StockAdjustmentsPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [lots, setLots] = useState([])
  const [form, setForm] = useState({ stockLotId: '', quantityDelta: '', weightDelta: '', reason: '' })

  useEffect(() => {
    pccApi.listStock({ limit: 100 }).then((d) => setLots(d.lots || [])).catch(() => {})
  }, [pccApi])

  const submit = async (e) => {
    e.preventDefault()
    try {
      await pccApi.adjustStock(form.stockLotId, {
        quantityDelta: Number(form.quantityDelta) || 0,
        weightDelta: Number(form.weightDelta) || 0,
        reason: form.reason,
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Stock adjusted')
      setForm({ stockLotId: '', quantityDelta: '', weightDelta: '', reason: '' })
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Adjustment failed')
    }
  }

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>STOCK ADJUSTMENTS</h2></div>
      <p className="pcc-muted">Requires adjustStock permission. Reason and audit are mandatory.</p>
      <form className="pcc-form" onSubmit={submit}>
        <label>Stock Lot
          <select className="pcc-input" required value={form.stockLotId}
            onChange={(e) => setForm((f) => ({ ...f, stockLotId: e.target.value }))}>
            <option value="">Select…</option>
            {lots.map((l) => (
              <option key={l._id} value={l._id}>{l.stockCode} — {l.product || l.metalType}</option>
            ))}
          </select>
        </label>
        <label>Qty delta<input className="pcc-input" type="number" step="any" value={form.quantityDelta}
          onChange={(e) => setForm((f) => ({ ...f, quantityDelta: e.target.value }))} /></label>
        <label>Weight delta (g)<input className="pcc-input" type="number" step="any" value={form.weightDelta}
          onChange={(e) => setForm((f) => ({ ...f, weightDelta: e.target.value }))} /></label>
        <label>Reason<input className="pcc-input" required minLength={3} value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></label>
        <button type="submit" className="pcc-btn">Apply Adjustment</button>
      </form>
    </div>
  )
}

export function MarkAvailableHelper({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [lots, setLots] = useState([])

  const load = useCallback(() => {
    pccApi.listStock({ status: 'NEW_STOCK', limit: 50 })
      .then((d) => setLots(d.lots || []))
      .catch(() => {})
  }, [pccApi])

  useEffect(() => { load() }, [load])

  const mark = async (id) => {
    try {
      await pccApi.markStockAvailable(id, {})
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Marked AVAILABLE')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed')
    }
  }

  if (!lots.length) return null
  return (
    <div className="pcc-panel" style={{ marginBottom: 12 }}>
      <div className="pcc-panel-head"><h2>RELEASE NEW STOCK → AVAILABLE</h2></div>
      <ul className="pcc-list">
        {lots.map((l) => (
          <li key={l._id}>
            <span>{l.stockCode} · {l.product || l.metalType} · {formatGrams(l.netWeight)}</span>
            <button type="button" className="pcc-btn-ghost" onClick={() => mark(l._id)}>Make Available</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

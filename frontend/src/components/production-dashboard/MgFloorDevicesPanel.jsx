import { useCallback, useEffect, useState } from 'react'
import { mgFloorDevicesApi } from '../../api/mgFloorDevices'
import './ProductionDashboard.css'

const TABS = [
  { id: 'scales', label: 'Scales' },
  { id: 'xrf', label: 'XRF' },
  { id: 'gateways', label: 'Gateways' },
]

export default function MgFloorDevicesPanel() {
  const [tab, setTab] = useState('scales')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === 'scales') {
        const data = await mgFloorDevicesApi.listScales({ search: search || undefined, limit: 200 })
        setRows(data.scales || [])
        setTotal(data.total || 0)
      } else if (tab === 'xrf') {
        const data = await mgFloorDevicesApi.listXrf({ search: search || undefined, limit: 200 })
        setRows(data.devices || data.analyzers || [])
        setTotal(data.total || 0)
      } else {
        const data = await mgFloorDevicesApi.listGateways({ limit: 100 })
        setRows(data.gateways || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load devices')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tab, search])

  useEffect(() => {
    load()
  }, [load])

  const onAdd = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (tab === 'scales') {
        await mgFloorDevicesApi.createScale({
          scaleId: form.scaleId,
          gatewayId: form.gatewayId || 'MG-GATEWAY-001',
          name: form.name,
          department: form.department,
          connectionType: form.connectionType || 'RS232',
          port: form.port,
        })
      } else if (tab === 'xrf') {
        await mgFloorDevicesApi.createXrf({
          analyzerId: form.analyzerId,
          gatewayId: form.gatewayId || 'MG-GATEWAY-001',
          model: form.model,
          department: form.department || 'quality_control',
        })
      } else {
        await mgFloorDevicesApi.createGateway({
          gatewayId: form.gatewayId,
          name: form.name,
          location: form.location,
        })
      }
      setShowAdd(false)
      setForm({})
      await load()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleEnabled = async (row) => {
    setBusy(true)
    try {
      if (tab === 'scales') {
        await mgFloorDevicesApi.updateScale(row.scaleId, { enabled: !row.enabled })
      } else if (tab === 'xrf') {
        await mgFloorDevicesApi.updateXrf(row.analyzerId, { enabled: !row.enabled })
      } else {
        await mgFloorDevicesApi.updateGateway(row.gatewayId, { enabled: !row.enabled })
      }
      await load()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const idKey = tab === 'scales' ? 'scaleId' : tab === 'xrf' ? 'analyzerId' : 'gatewayId'

  return (
    <div className="pd-devices" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, flex: 1 }}>MG Floor Devices</h2>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pd-btn ${tab === t.id ? 'pd-btn--primary' : ''}`}
            onClick={() => { setTab(t.id); setShowAdd(false); setForm({}) }}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="pd-btn pd-btn--primary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : 'Add'}
        </button>
        <button type="button" className="pd-btn" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Registry is dynamic — seed includes MG-SCALE-001…007; add more without code changes.
        Secrets stay in Railway <code>MG_GATEWAY_SECRETS</code>.
      </p>

      {tab !== 'gateways' ? (
        <input
          className="pd-input"
          style={{ width: '100%', maxWidth: 360, marginBottom: 12, padding: 8 }}
          placeholder="Search id / model / department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      ) : null}

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      {showAdd ? (
        <form onSubmit={onAdd} style={{ display: 'grid', gap: 8, maxWidth: 480, marginBottom: 16, padding: 12, border: '1px solid #334155', borderRadius: 8 }}>
          {tab === 'scales' ? (
            <>
              <input required placeholder="scaleId e.g. MG-SCALE-008" value={form.scaleId || ''} onChange={(e) => setForm({ ...form, scaleId: e.target.value })} />
              <input required placeholder="gatewayId e.g. MG-GATEWAY-001" value={form.gatewayId || 'MG-GATEWAY-001'} onChange={(e) => setForm({ ...form, gatewayId: e.target.value })} />
              <input placeholder="name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="department" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <input placeholder="port / COM" value={form.port || ''} onChange={(e) => setForm({ ...form, port: e.target.value })} />
              <select value={form.connectionType || 'RS232'} onChange={(e) => setForm({ ...form, connectionType: e.target.value })}>
                <option value="RS232">RS232</option>
                <option value="ETHERNET">ETHERNET</option>
                <option value="SIMULATOR">SIMULATOR</option>
                <option value="USB">USB (stub)</option>
                <option value="BLUETOOTH">BLUETOOTH (stub)</option>
              </select>
            </>
          ) : null}
          {tab === 'xrf' ? (
            <>
              <input required placeholder="analyzerId e.g. MG-XRF-002" value={form.analyzerId || ''} onChange={(e) => setForm({ ...form, analyzerId: e.target.value })} />
              <input required placeholder="gatewayId" value={form.gatewayId || 'MG-GATEWAY-001'} onChange={(e) => setForm({ ...form, gatewayId: e.target.value })} />
              <input placeholder="model" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </>
          ) : null}
          {tab === 'gateways' ? (
            <>
              <input required placeholder="gatewayId e.g. MG-GATEWAY-002" value={form.gatewayId || ''} onChange={(e) => setForm({ ...form, gatewayId: e.target.value })} />
              <input placeholder="name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="location" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </>
          ) : null}
          <button type="submit" className="pd-btn pd-btn--primary" disabled={busy}>Create</button>
        </form>
      ) : null}

      <p style={{ marginBottom: 8 }}>{loading ? 'Loading…' : `${total} registered`}</p>

      <div style={{ overflowX: 'auto' }}>
        <table className="pd-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Status</th>
              <th align="left">Gateway</th>
              <th align="left">Dept / Loc</th>
              <th align="left">Conn</th>
              <th align="left">Enabled</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[idKey]}>
                <td>{row[idKey]}</td>
                <td>{row.status || '—'}</td>
                <td>{row.gatewayId || '—'}</td>
                <td>{row.department || row.location || '—'}</td>
                <td>{row.connectionType || '—'}</td>
                <td>{row.enabled === false ? 'No' : 'Yes'}</td>
                <td>
                  <button type="button" className="pd-btn" disabled={busy} onClick={() => toggleEnabled(row)}>
                    {row.enabled === false ? 'Enable' : 'Disable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

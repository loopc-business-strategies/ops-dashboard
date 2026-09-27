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
        const captureMethods = [
          form.captureDigital !== false ? 'DIGITAL_RS232' : null,
          form.captureCamera ? 'CAMERA_OCR' : null,
        ].filter(Boolean)
        if (!captureMethods.length) throw new Error('Choose at least one capture method')
        const usesDigital = captureMethods.includes('DIGITAL_RS232')
        await mgFloorDevicesApi.createScale({
          scaleId: form.scaleId,
          name: form.name,
          department: form.department,
          manufacturer: form.manufacturer,
          model: form.model,
          unit: form.unit || 'g',
          capacity: form.capacity ? Number(form.capacity) : null,
          resolution: form.resolution ? Number(form.resolution) : null,
          captureMethods,
          ...(usesDigital
            ? {
                gatewayId: form.gatewayId || 'MG-GATEWAY-001',
                connectionType: form.connectionType || 'RS232',
                port: form.port,
              }
            : { connectionType: 'CAMERA' }),
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

  const removeScale = async (row) => {
    const reason = window.prompt(`Remove ${row.scaleId} from the registry? History and readings are kept.\nReason:`)
    if (reason == null) return
    if (reason.trim().length < 3) {
      setError('A reason (at least 3 characters) is required to remove a scale')
      return
    }
    setBusy(true)
    setError('')
    try {
      await mgFloorDevicesApi.archiveScale(row.scaleId, reason.trim())
      await load()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  const applyGj2000Profile = () => {
    setForm({
      ...form,
      manufacturer: 'Shinko Denshi',
      model: 'GJ-2000',
      unit: 'g',
      capacity: '2200',
      resolution: '0.01',
    })
  }

  const scaleUsesDigital = form.captureDigital !== false
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
        Registry is dynamic — it starts empty unless <code>MG_FLOOR_SEED_DEFAULT_SCALES=true</code>; add scales
        without code changes. Camera-only scales (scale camera OCR) need no gateway.
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
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.captureDigital !== false}
                    onChange={(e) => setForm({ ...form, captureDigital: e.target.checked })}
                  />{' '}
                  Digital scale (RS-232 via gateway)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(form.captureCamera)}
                    onChange={(e) => setForm({ ...form, captureCamera: e.target.checked })}
                  />{' '}
                  Scale camera (OCR on tablet)
                </label>
              </div>
              <input placeholder="name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input placeholder="department" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ flex: 1 }} placeholder="manufacturer" value={form.manufacturer || ''} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                <input style={{ flex: 1 }} placeholder="model" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                <button type="button" className="pd-btn" onClick={applyGj2000Profile}>GJ-2000</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1 }} type="number" step="any" min="0" placeholder="capacity (g)" value={form.capacity || ''} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                <input style={{ flex: 1 }} type="number" step="any" min="0" placeholder="resolution (g)" value={form.resolution || ''} onChange={(e) => setForm({ ...form, resolution: e.target.value })} />
                <input style={{ width: 64 }} placeholder="unit" value={form.unit || 'g'} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              {scaleUsesDigital ? (
                <>
                  <input required placeholder="gatewayId e.g. MG-GATEWAY-001" value={form.gatewayId || 'MG-GATEWAY-001'} onChange={(e) => setForm({ ...form, gatewayId: e.target.value })} />
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
              {tab === 'scales' ? <th align="left">Capture</th> : null}
              {tab === 'scales' ? <th align="left">Capacity</th> : null}
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
                {tab === 'scales' ? (
                  <td>
                    {(row.captureMethods?.length ? row.captureMethods : ['DIGITAL_RS232'])
                      .map((m) => (m === 'CAMERA_OCR' ? 'Camera OCR' : 'Digital'))
                      .join(' + ')}
                  </td>
                ) : null}
                {tab === 'scales' ? (
                  <td>
                    {row.capacity != null ? `${row.capacity} ${row.unit || 'g'}` : '—'}
                    {row.resolution != null ? ` · d=${row.resolution}` : ''}
                  </td>
                ) : null}
                <td>{row.enabled === false ? 'No' : 'Yes'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="pd-btn" disabled={busy} onClick={() => toggleEnabled(row)}>
                    {row.enabled === false ? 'Enable' : 'Disable'}
                  </button>
                  {tab === 'scales' ? (
                    <button
                      type="button"
                      className="pd-btn"
                      style={{ marginLeft: 6 }}
                      disabled={busy}
                      onClick={() => removeScale(row)}
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

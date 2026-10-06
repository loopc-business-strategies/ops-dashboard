import { useCallback, useEffect, useState } from 'react'
import {
  assignEnquiry,
  getEnquiryAssignees,
  listWebsiteEnquiries,
  updateEnquiryStatus,
} from '../../../api/websiteEnquiries'

const C = {
  border: 'var(--brand-border)',
  ink: '#0F172A',
  inkSoft: '#64748B',
}

const STATUSES = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION', 'WON', 'LOST']

const STATUS_LABELS = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  FOLLOW_UP: 'Follow-up',
  QUOTATION: 'Quotation',
  WON: 'Won',
  LOST: 'Lost',
}

const STATUS_COLORS = {
  NEW: { bg: '#EFF6FF', fg: '#1D4ED8' },
  CONTACTED: { bg: '#F5F3FF', fg: '#6D28D9' },
  FOLLOW_UP: { bg: '#FFFBEB', fg: '#B45309' },
  QUOTATION: { bg: '#ECFEFF', fg: '#0E7490' },
  WON: { bg: '#ECFDF5', fg: '#047857' },
  LOST: { bg: '#FEF2F2', fg: '#B91C1C' },
}

const REQUIREMENT_LABELS = {
  sales: 'Gold / Jewellery Requirement',
  procurement: 'Gold / Material Requirement',
}

const FIXED_COLUMN_COUNT = 7

function optionalColumns(variant) {
  return [
    { key: 'company', label: 'Company', style: cell },
    {
      key: 'email',
      label: 'Email',
      style: cell,
      render: (item) => <a href={`mailto:${item.email}`}>{item.email}</a>,
    },
    {
      key: 'requirement',
      label: REQUIREMENT_LABELS[variant] || REQUIREMENT_LABELS.sales,
      style: { ...cell, minWidth: 180, whiteSpace: 'pre-wrap' },
    },
    { key: 'message', label: 'Message', style: { ...cell, minWidth: 200, whiteSpace: 'pre-wrap' } },
  ]
}

const cell = { padding: '8px', verticalAlign: 'top' }
const head = { padding: '6px 8px', whiteSpace: 'nowrap' }
const selectStyle = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff' }

function StatusPill({ status }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.NEW
  return (
    <span style={{ background: colors.bg, color: colors.fg, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function WebsiteEnquiriesPanel({ variant = 'sales' }) {
  const [items, setItems] = useState([])
  const [assignees, setAssignees] = useState([])
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { limit: 200 }
      if (statusFilter) params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      const res = await listWebsiteEnquiries(params)
      setItems(Array.isArray(res?.data) ? res.data : [])
      setCanEdit(Boolean(res?.canEdit))
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load website enquiries')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getEnquiryAssignees()
      .then((res) => setAssignees(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setAssignees([]))
  }, [])

  const replaceItem = (updated) => {
    if (!updated?._id) return
    setItems((prev) => prev.map((item) => (item._id === updated._id ? updated : item)))
  }

  const handleStatusChange = async (id, status) => {
    setSavingId(id)
    setError('')
    try {
      const res = await updateEnquiryStatus(id, status)
      replaceItem(res?.data)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to update status')
    } finally {
      setSavingId('')
    }
  }

  const handleAssign = async (id, userId) => {
    setSavingId(id)
    setError('')
    try {
      const res = await assignEnquiry(id, userId)
      replaceItem(res?.data)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to assign enquiry')
    } finally {
      setSavingId('')
    }
  }

  const extraColumns = optionalColumns(variant).filter((col) => items.some((item) => item[col.key]))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <input
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            style={{ marginBottom: 0 }}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, padding: '8px 10px', fontSize: 13 }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#FECACA', background: '#FEF2F2', color: '#B91C1C' }}>{error}</div>
      )}

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: C.inkSoft }}>
                <th style={head}>Customer Name</th>
                <th style={head}>Phone Number</th>
                <th style={head}>Enquiry Type</th>
                {extraColumns.map((col) => <th key={col.key} style={head}>{col.label}</th>)}
                <th style={head}>Source</th>
                <th style={head}>Status</th>
                <th style={head}>Date / Time</th>
                <th style={head}>Assigned Employee</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} style={{ borderTop: `1px solid ${C.border}`, opacity: savingId === item._id ? 0.6 : 1 }}>
                  <td style={{ ...cell, fontWeight: 600, color: C.ink }}>{item.name}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}><a href={`tel:${item.phone}`}>{item.phone}</a></td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{String(item.enquiryType || '').toUpperCase()}</td>
                  {extraColumns.map((col) => (
                    <td key={col.key} style={col.style}>
                      {item[col.key] ? (col.render ? col.render(item) : item[col.key]) : '—'}
                    </td>
                  ))}
                  <td style={cell}>{String(item.source || 'website').toUpperCase()}</td>
                  <td style={cell}>
                    {canEdit ? (
                      <select
                        value={item.status}
                        disabled={savingId === item._id}
                        onChange={(e) => handleStatusChange(item._id, e.target.value)}
                        style={selectStyle}
                        aria-label={`Status for ${item.name}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    ) : <StatusPill status={item.status} />}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDateTime(item.createdAt)}</td>
                  <td style={cell}>
                    {canEdit ? (
                      <select
                        value={item.assignedTo || ''}
                        disabled={savingId === item._id}
                        onChange={(e) => handleAssign(item._id, e.target.value)}
                        style={selectStyle}
                        aria-label={`Assigned employee for ${item.name}`}
                      >
                        <option value="">Unassigned</option>
                        {item.assignedTo && !assignees.some((a) => a._id === item.assignedTo) && (
                          <option value={item.assignedTo}>{item.assignedToName || 'Assigned user'}</option>
                        )}
                        {assignees.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.name}{a.department ? ` (${a.department})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (item.assignedToName || 'Unassigned')}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={FIXED_COLUMN_COUNT + extraColumns.length} style={{ padding: 12, color: C.inkSoft }}>
                    {loading ? 'Loading website enquiries…' : 'No website enquiries yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

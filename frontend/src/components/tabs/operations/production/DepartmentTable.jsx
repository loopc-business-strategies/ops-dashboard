import { useEffect, useMemo, useState } from 'react'
import { useVirtualTableRows } from '../../../../hooks/useVirtualTableRows'
import {
  SHEET_COLUMNS,
  formatMinutes,
  formatWeight,
  isoDate,
  sortRows,
} from './productionSheetUtils'

const TABLE_VIEWPORT_H = 360

const pane = {
  border: '1px solid #94A3B8',
  borderRadius: '0 0 0.375rem 0.375rem',
  background: '#FFFFFF',
  overflow: 'hidden',
}

const scrollBox = {
  maxHeight: TABLE_VIEWPORT_H,
  overflowY: 'auto',
  overflowX: 'auto',
}

const table = {
  width: '100%',
  minWidth: 1680,
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '0.88rem',
  color: '#0F172A',
}

const thBase = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  background: '#E2E8F0',
  borderBottom: '1px solid #94A3B8',
  borderRight: '1px solid #CBD5E1',
  padding: '0.45rem 0.55rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  textAlign: 'left',
  userSelect: 'none',
}

const tdBase = {
  borderBottom: '1px solid #E2E8F0',
  borderRight: '1px solid #E2E8F0',
  padding: '0.3rem 0.35rem',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}

const inputStyle = {
  width: '100%',
  minWidth: 72,
  boxSizing: 'border-box',
  border: '1px solid #CBD5E1',
  borderRadius: 4,
  padding: '0.25rem 0.35rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  color: '#0F172A',
  background: '#FFFFFF',
}

const btnBase = {
  border: '1px solid #94A3B8',
  borderRadius: 4,
  padding: '0.2rem 0.45rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  cursor: 'pointer',
  background: '#F8FAFC',
  color: '#0F172A',
  marginRight: 4,
}

const footerBar = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 0.65rem',
  borderTop: '1px solid #CBD5E1',
  background: '#F8FAFC',
}

const EDITABLE_KEYS = new Set([
  'date',
  'batch',
  'metalIn',
  'metalOut',
  'batchStarted',
  'batchOver',
  'departmentManager',
  'employee',
  'rating',
  'breakdown',
  'requests',
])

function cellDisplay(row, key) {
  if (key === 'metalIn') return row.metalInDisplay
  if (key === 'metalOut') return row.metalOutDisplay
  if (key === 'metalLoss') return row.metalLossDisplay
  if (key === 'timeBatch') return row.timeBatchDisplay
  return row[key] ?? '—'
}

function toDatetimeLocal(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function computeLoss(inn, out) {
  if (inn == null || out == null) return null
  if (!Number.isFinite(inn) || !Number.isFinite(out)) return null
  return Math.max(0, inn - out)
}

function durationFrom(startIso, endIso) {
  if (!startIso) return null
  const start = new Date(startIso)
  if (!Number.isFinite(start.getTime())) return null
  const end = endIso ? new Date(endIso) : new Date()
  if (!Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

function patchDraft(prev, patch) {
  const next = { ...prev, ...patch }
  if (patch.metalIn !== undefined || patch.metalOut !== undefined) {
    const inn = next.metalIn == null || next.metalIn === '' ? null : Number(next.metalIn)
    const out = next.metalOut == null || next.metalOut === '' ? null : Number(next.metalOut)
    next.metalIn = Number.isFinite(inn) ? inn : null
    next.metalOut = Number.isFinite(out) ? out : null
    next.metalLoss = computeLoss(next.metalIn, next.metalOut)
    next.metalInDisplay = formatWeight(next.metalIn)
    next.metalOutDisplay = formatWeight(next.metalOut)
    next.metalLossDisplay = formatWeight(next.metalLoss)
  }
  if (patch.batchStartedRaw !== undefined || patch.batchOverRaw !== undefined) {
    const mins = durationFrom(next.batchStartedRaw, next.batchOverRaw)
    next.timeBatch = mins
    next.timeBatchDisplay = formatMinutes(mins)
  }
  if (patch.dateKey !== undefined) {
    const d = patch.dateKey ? new Date(`${patch.dateKey}T12:00:00`) : null
    next.dateRaw = d && Number.isFinite(d.getTime()) ? d : null
    if (next.dateRaw) {
      const dd = String(next.dateRaw.getDate()).padStart(2, '0')
      const mm = String(next.dateRaw.getMonth() + 1).padStart(2, '0')
      next.date = `${dd}/${mm}/${next.dateRaw.getFullYear()}`
    }
  }
  return next
}

/**
 * Excel-style department table with sticky headers and independent scroll.
 * When editable: view mode by default; Edit unlocks inputs; Save / Del in Actions.
 */
export default function DepartmentTable({
  rows,
  editable = false,
  savingId = null,
  onSaveRow,
  onDeleteRow,
  onAddRow,
}) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [drafts, setDrafts] = useState({})
  const [editingIds, setEditingIds] = useState(() => new Set())

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev }
      const ids = new Set((rows || []).map((r) => String(r.id)))
      Object.keys(next).forEach((id) => {
        if (!ids.has(id)) delete next[id]
      })
      return next
    })
    setEditingIds((prev) => {
      const next = new Set()
      ;(rows || []).forEach((r) => {
        const id = String(r.id)
        if (r._isNew || prev.has(id)) next.add(id)
      })
      return next
    })
  }, [rows])

  const sorted = useMemo(
    () => sortRows(rows || [], sortKey, sortDir),
    [rows, sortKey, sortDir],
  )

  const { scrollRef, enabled, virtualItems, paddingTop, paddingBottom } = useVirtualTableRows(
    sorted.length,
    { estimateSize: 42, threshold: editable ? 9999 : 60, overscan: 10 },
  )

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'employee' || key === 'batch' || key === 'departmentManager' ? 'asc' : 'desc')
    }
  }

  const isEditing = (row) => editingIds.has(String(row.id)) || Boolean(row._isNew)

  const getDraft = (row) => {
    const id = String(row.id)
    return drafts[id] || row
  }

  const setField = (row, patch) => {
    const id = String(row.id)
    setDrafts((prev) => ({
      ...prev,
      [id]: patchDraft(prev[id] || row, patch),
    }))
  }

  const startEdit = (row) => {
    const id = String(row.id)
    setEditingIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setDrafts((prev) => (prev[id] ? prev : { ...prev, [id]: { ...row } }))
  }

  const handleSave = async (row) => {
    if (!onSaveRow) return
    const draft = getDraft(row)
    await onSaveRow(draft)
    const id = String(row.id)
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setEditingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const colSpan = SHEET_COLUMNS.length + (editable ? 1 : 0)

  const renderEditableCell = (row, col) => {
    const draft = getDraft(row)
    const key = col.key

    if (key === 'metalLoss' || key === 'timeBatch') {
      return (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {key === 'metalLoss' ? formatWeight(draft.metalLoss) : formatMinutes(draft.timeBatch)}
        </span>
      )
    }

    if (!EDITABLE_KEYS.has(key)) {
      return cellDisplay(draft, key)
    }

    if (key === 'date') {
      return (
        <input
          type="date"
          style={inputStyle}
          value={draft.dateKey || isoDate(new Date())}
          onChange={(e) => setField(row, { dateKey: e.target.value })}
        />
      )
    }

    if (key === 'metalIn' || key === 'metalOut') {
      return (
        <input
          type="number"
          min="0"
          step="0.01"
          style={{ ...inputStyle, textAlign: 'right', minWidth: 88 }}
          value={draft[key] == null ? '' : draft[key]}
          onChange={(e) => {
            const v = e.target.value
            setField(row, { [key]: v === '' ? null : v })
          }}
        />
      )
    }

    if (key === 'batchStarted') {
      return (
        <input
          type="datetime-local"
          style={{ ...inputStyle, minWidth: 160 }}
          value={toDatetimeLocal(draft.batchStartedRaw)}
          onChange={(e) => setField(row, { batchStartedRaw: fromDatetimeLocal(e.target.value) })}
        />
      )
    }

    if (key === 'batchOver') {
      return (
        <input
          type="datetime-local"
          style={{ ...inputStyle, minWidth: 160 }}
          value={toDatetimeLocal(draft.batchOverRaw)}
          onChange={(e) => setField(row, { batchOverRaw: fromDatetimeLocal(e.target.value) })}
        />
      )
    }

    const fieldMap = {
      batch: 'batch',
      departmentManager: 'departmentManager',
      employee: 'employee',
      rating: 'rating',
      breakdown: 'breakdown',
      requests: 'requests',
    }
    const field = fieldMap[key]
    const raw = draft[field]
    const display = raw === '—' ? '' : (raw ?? '')

    return (
      <input
        type="text"
        style={{ ...inputStyle, minWidth: key === 'breakdown' || key === 'requests' ? 120 : 90 }}
        value={display}
        onChange={(e) => setField(row, { [field]: e.target.value })}
      />
    )
  }

  const renderRow = (row, idx) => {
    const busy = savingId != null && String(savingId) === String(row.id)
    const editing = editable && isEditing(row)
    const displayRow = editing ? getDraft(row) : row

    return (
      <tr
        key={row.id || idx}
        style={{ background: row._isNew || editing ? '#FFFBEB' : (idx % 2 ? '#F8FAFC' : '#FFFFFF') }}
      >
        {SHEET_COLUMNS.map((col) => (
          <td
            key={col.key}
            style={{
              ...tdBase,
              textAlign: col.align || 'left',
              fontWeight: 500,
              fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
            }}
          >
            {editing ? renderEditableCell(row, col) : cellDisplay(displayRow, col.key)}
          </td>
        ))}
        {editable ? (
          <td style={{ ...tdBase, whiteSpace: 'nowrap' }}>
            {!editing ? (
              <button
                type="button"
                style={{ ...btnBase, background: '#DBEAFE', borderColor: '#93C5FD' }}
                disabled={busy}
                onClick={() => startEdit(row)}
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                style={{ ...btnBase, background: '#DCFCE7', borderColor: '#86EFAC' }}
                disabled={busy}
                onClick={() => handleSave(row)}
              >
                {busy ? '…' : 'Save'}
              </button>
            )}
            <button
              type="button"
              style={{ ...btnBase, background: '#FEE2E2', borderColor: '#FECACA', color: '#991B1B', marginRight: 0 }}
              disabled={busy}
              onClick={() => onDeleteRow?.(row)}
            >
              Del
            </button>
          </td>
        ) : null}
      </tr>
    )
  }

  return (
    <div style={pane}>
      <div ref={scrollRef} style={scrollBox}>
        <table style={table}>
          <thead>
            <tr>
              {SHEET_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{ ...thBase, textAlign: col.align || 'left', cursor: col.sortable ? 'pointer' : 'default' }}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  {col.label}
                  {col.sortable ? (
                    <span style={{ marginLeft: 4, opacity: sortKey === col.key ? 1 : 0.35, fontSize: '0.7rem' }}>
                      {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  ) : null}
                </th>
              ))}
              {editable ? (
                <th style={{ ...thBase, width: 140 }}>Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr>
                <td style={tdBase} colSpan={colSpan}>
                  No production rows for this department.
                </td>
              </tr>
            ) : enabled && virtualItems ? (
              <>
                {paddingTop > 0 ? (
                  <tr><td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
                ) : null}
                {virtualItems.map((v) => renderRow(sorted[v.index], v.index))}
                {paddingBottom > 0 ? (
                  <tr><td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
                ) : null}
              </>
            ) : (
              sorted.map((row, idx) => renderRow(row, idx))
            )}
          </tbody>
        </table>
      </div>
      {editable ? (
        <div style={footerBar}>
          <button
            type="button"
            style={{ ...btnBase, background: '#DBEAFE', borderColor: '#93C5FD', marginRight: 0 }}
            onClick={() => onAddRow?.()}
          >
            + Add row
          </button>
        </div>
      ) : null}
    </div>
  )
}

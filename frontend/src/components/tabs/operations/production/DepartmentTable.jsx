import { useEffect, useMemo, useState } from 'react'
import { useVirtualTableRows } from '../../../../hooks/useVirtualTableRows'
import {
  MG_FLOOR_EDITABLE_KEYS,
  SHEET_COLUMNS,
  computeDepartmentTotals,
  computeFineGold,
  formatMinutes,
  formatPurity,
  formatWeight,
  isOverLossLimit,
  isOverdueBatch,
  isoDate,
  lossFigures,
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
  minWidth: 2340,
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

const actionsTh = {
  ...thBase,
  width: 190,
  minWidth: 190,
  whiteSpace: 'nowrap',
}

const actionsTd = {
  ...tdBase,
  width: 190,
  minWidth: 190,
  whiteSpace: 'nowrap',
}

const footerBar = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.45rem 0.65rem',
  borderTop: '1px solid #CBD5E1',
  background: '#F8FAFC',
}

const floorBadge = {
  marginLeft: 6,
  padding: '0.05rem 0.35rem',
  borderRadius: 999,
  background: '#FFEDD5',
  border: '1px solid #FDBA74',
  color: '#9A3412',
  fontSize: '0.68rem',
  fontWeight: 800,
}

const totalTd = {
  ...tdBase,
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  background: '#E2E8F0',
  borderTop: '2px solid #94A3B8',
  fontWeight: 800,
}

const overLimitStyle = { color: '#B91C1C', fontWeight: 800 }

const EDITABLE_KEYS = new Set([
  'date',
  'batch',
  'metalIn',
  'purity',
  'metalOut',
  'purityOut',
  'batchStarted',
  'batchOver',
  'departmentManager',
  'employee',
  'rating',
  'breakdown',
  'requests',
])

const GAIN_TITLE = 'Metal OUT is more than Metal IN — check the weights'

function metalLossCell(row) {
  if (row.metalGain == null) return row.metalLossDisplay ?? formatWeight(row.metalLoss)
  return <span style={overLimitStyle} title={GAIN_TITLE}>Gain +{formatWeight(row.metalGain)}</span>
}

function timeBatchCell(row) {
  const text = formatMinutes(row.timeBatch)
  if (!isOverdueBatch(row)) return text
  return (
    <span style={overLimitStyle} title="Still open after 12 hours — was the Metal Out sent?">
      {text} · Metal Out missing?
    </span>
  )
}

function lossPctCell(lossPct, lossLimitPct) {
  if (lossPct == null) return '—'
  if (lossPct < 0) return <span style={overLimitStyle} title={GAIN_TITLE}>{`${lossPct}%`}</span>
  if (!isOverLossLimit(lossPct, lossLimitPct)) return `${lossPct}%`
  return (
    <span style={overLimitStyle} title={`Above the ${lossLimitPct}% loss limit`}>
      {`${lossPct}%`}
    </span>
  )
}

function fineGoldOutCell(value, estimated) {
  if (value == null) return '—'
  if (!estimated) return formatWeight(value)
  return <span title="Purity OUT not recorded — worked out with Purity IN">≈ {formatWeight(value)}</span>
}

function fineLossCell(value) {
  if (value == null) return '—'
  if (value >= 0) return formatWeight(value)
  return (
    <span style={overLimitStyle} title="Fine gold OUT is more than IN — check the purities">
      {formatWeight(value)}
    </span>
  )
}

function cellDisplay(row, key, lossLimitPct = null) {
  if (key === 'purityOut') return formatPurity(row.purityOut)
  if (key === 'fineGoldOut') return fineGoldOutCell(row.fineGoldOut, row.fineGoldOutEstimated)
  if (key === 'lossPct') return lossPctCell(row.lossPct, lossLimitPct)
  if (key === 'fineLoss') return fineLossCell(row.fineLoss)
  if (key === 'batch' && row.fromFloor) {
    return (
      <span title="From an approved MG Floor batch — metal, times and names are read-only">
        {row.batch ?? '—'}
        <span style={floorBadge}>MG Floor</span>
      </span>
    )
  }
  if (key === 'metalIn') return row.metalInDisplay
  if (key === 'purity') return formatPurity(row.purity)
  if (key === 'fineGold') return formatWeight(row.fineGold)
  if (key === 'metalOut') return row.metalOutDisplay
  if (key === 'metalLoss') return metalLossCell(row)
  if (key === 'timeBatch') return timeBatchCell(row)
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
  if (patch.purity !== undefined) {
    const p = next.purity == null || next.purity === '' ? null : Number(next.purity)
    next.purity = Number.isFinite(p) ? p : null
  }
  if (patch.purityOut !== undefined) {
    const p = next.purityOut == null || next.purityOut === '' ? null : Number(next.purityOut)
    next.purityOut = Number.isFinite(p) ? p : null
  }
  if (patch.metalIn !== undefined || patch.purity !== undefined) {
    next.fineGold = computeFineGold(next.metalIn, next.purity)
  }
  if (['metalIn', 'metalOut', 'purity', 'purityOut'].some((k) => patch[k] !== undefined)) {
    Object.assign(next, lossFigures({ ...next, fineGoldOut: null }))
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
  lossLimitPct = null,
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

  const totals = useMemo(() => computeDepartmentTotals(rows || []), [rows])

  const totalCell = (key) => {
    const t = totals
    if (key === 'date') return 'Total'
    if (key === 'batch') return `${t.batches} ${t.batches === 1 ? 'batch' : 'batches'}`
    if (key === 'metalLoss' && t.gains) {
      return (
        <>
          {formatWeight(t.metalLoss)}
          <span style={overLimitStyle} title={GAIN_TITLE}> · {t.gains} gain{t.gains === 1 ? '' : 's'}</span>
        </>
      )
    }
    if (key === 'metalIn' || key === 'fineGold' || key === 'metalOut' || key === 'metalLoss') return formatWeight(t[key])
    if (key === 'purity' || key === 'purityOut') return formatPurity(t[key])
    if (key === 'fineGoldOut') return fineGoldOutCell(t.fineGoldOut, t.fineGoldOutEstimated)
    if (key === 'lossPct') return lossPctCell(t.lossPct, lossLimitPct)
    if (key === 'fineLoss') return fineLossCell(t.fineLoss)
    if (key === 'timeBatch') {
      const avg = t.avgTime == null ? '—' : (
        <span title={`Average of ${t.finishedBatches} finished ${t.finishedBatches === 1 ? 'batch' : 'batches'}`}>
          Avg {formatMinutes(t.avgTime)}
        </span>
      )
      if (!t.overdue) return avg
      return (
        <>
          {avg}
          <span style={overLimitStyle} title="Batches still open after 12 hours — was the Metal Out sent?">
            {' · '}{t.overdue} open over 12h
          </span>
        </>
      )
    }
    return ''
  }

  const renderEditableCell = (row, col) => {
    const draft = getDraft(row)
    const key = col.key

    if (row.fromFloor && !MG_FLOOR_EDITABLE_KEYS.includes(key)) {
      return cellDisplay(draft, key, lossLimitPct)
    }

    if (key === 'fineGoldOut' || key === 'lossPct' || key === 'fineLoss' || key === 'metalLoss' || key === 'timeBatch') {
      return cellDisplay(draft, key, lossLimitPct)
    }

    if (key === 'fineGold') {
      return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatWeight(draft.fineGold)}</span>
    }

    if (!EDITABLE_KEYS.has(key)) {
      return cellDisplay(draft, key, lossLimitPct)
    }

    if (key === 'purity' || key === 'purityOut') {
      return (
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          aria-label={key === 'purity' ? 'Purity IN %' : 'Purity OUT %'}
          style={{ ...inputStyle, textAlign: 'right', minWidth: 72 }}
          value={draft[key] == null ? '' : draft[key]}
          onChange={(e) => {
            const v = e.target.value
            setField(row, { [key]: v === '' ? null : v })
          }}
        />
      )
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
    const rowBg = row._isNew || editing ? '#FFFBEB' : (idx % 2 ? '#F8FAFC' : '#FFFFFF')

    return (
      <tr
        key={row.id || idx}
        style={{ background: rowBg }}
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
            {editing ? renderEditableCell(row, col) : cellDisplay(displayRow, col.key, lossLimitPct)}
          </td>
        ))}
        {editable ? (
          <td style={actionsTd}>
            <button
              type="button"
              style={{ ...btnBase, background: '#DBEAFE', borderColor: '#93C5FD' }}
              disabled={busy || editing}
              onClick={() => startEdit(row)}
            >
              Edit
            </button>
            <button
              type="button"
              style={{ ...btnBase, background: '#DCFCE7', borderColor: '#86EFAC' }}
              disabled={busy || !editing}
              onClick={() => handleSave(row)}
            >
              {busy ? '…' : 'Save'}
            </button>
            <button
              type="button"
              style={{ ...btnBase, background: '#FEE2E2', borderColor: '#FECACA', color: '#991B1B', marginRight: 0 }}
              disabled={busy || row.fromFloor}
              title={row.fromFloor ? 'Rows from approved MG Floor batches cannot be deleted' : undefined}
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
                <th style={actionsTh}>Actions</th>
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
          {sorted.length ? (
            <tfoot>
              <tr data-testid="department-total-row">
                {SHEET_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      ...totalTd,
                      textAlign: col.align || 'left',
                      fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
                    }}
                  >
                    {totalCell(col.key)}
                  </td>
                ))}
                {editable ? <td style={totalTd} /> : null}
              </tr>
            </tfoot>
          ) : null}
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

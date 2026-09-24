import { useEffect, useMemo, useState } from 'react'
import { productionControlApi } from '../../../api/productionControl'
import {
  DASHBOARD_DEPARTMENTS,
  matchDashboardDeptKey,
} from '../../production-dashboard/departmentConfig'

const COLUMNS = [
  'Date',
  'batch',
  'metal in',
  'metal out',
  'metal loss',
  'time consumed',
  'employees',
  'rating',
  'breakdown',
  'requests',
]

const sheetWrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  width: '100%',
  minWidth: 0,
}

const sectionTitle = {
  margin: '0 0 0.5rem',
  fontSize: '1.05rem',
  fontWeight: 700,
  color: '#0F172A',
  textTransform: 'lowercase',
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  fontSize: '0.82rem',
  color: '#0F172A',
}

const thStyle = {
  border: '1px solid #94A3B8',
  background: '#F1F5F9',
  padding: '0.4rem 0.55rem',
  textAlign: 'left',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const tdStyle = {
  border: '1px solid #94A3B8',
  padding: '0.35rem 0.55rem',
  verticalAlign: 'top',
}

function formatSheetDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function dateKey(value) {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function numDisplay(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return String(n)
}

function timeConsumed(batch) {
  const mins = Number(
    batch?.actualDurationMinutes
    ?? batch?.durationMinutes
    ?? batch?.processDurationMinutes
    ?? batch?.elapsedMinutes
    ?? 0,
  )
  if (!Number.isFinite(mins) || mins <= 0) return '—'
  return String(Number(mins.toFixed(2)))
}

function employeeNames(batch) {
  const holders = []
  const primary = batch?.currentHolderName || batch?.operatorName || batch?.assignedToName
  if (primary) holders.push(String(primary).trim())
  const list = batch?.operators || batch?.employees || batch?.crew || []
  if (Array.isArray(list)) {
    list.forEach((e) => {
      const name = typeof e === 'string' ? e : (e?.name || e?.fullName || '')
      if (name && !holders.includes(name)) holders.push(String(name).trim())
    })
  }
  return holders.length ? holders.join('\n') : '—'
}

function metalIn(batch) {
  return batch?.processInputWeight ?? batch?.issuedWeight ?? batch?.initialWeight ?? null
}

function metalOut(batch) {
  return batch?.processOutputWeight ?? batch?.receivedWeight ?? batch?.currentWeight ?? null
}

function metalLoss(batch) {
  const inn = Number(metalIn(batch))
  const out = Number(metalOut(batch))
  if (Number.isFinite(inn) && Number.isFinite(out)) return Math.max(0, inn - out)
  const explicit = Number(batch?.metalLoss ?? batch?.loss ?? batch?.scrapWeight)
  return Number.isFinite(explicit) ? explicit : null
}

function mapBatchRow(batch, indexInDay) {
  return {
    id: batch?._id || batch?.id || `${dateKey(batch?.createdAt)}-${indexInDay}`,
    date: formatSheetDate(batch?.startedAt || batch?.createdAt || batch?.updatedAt),
    dateKey: dateKey(batch?.startedAt || batch?.createdAt || batch?.updatedAt),
    batch: indexInDay,
    metalIn: numDisplay(metalIn(batch)),
    metalOut: numDisplay(metalOut(batch)),
    metalLoss: numDisplay(metalLoss(batch)),
    timeConsumed: timeConsumed(batch),
    employees: employeeNames(batch),
    rating: batch?.rating != null && batch?.rating !== '' ? String(batch.rating) : '—',
    breakdown: batch?.breakdown || batch?.breakdownNotes || '—',
    requests: batch?.requests || batch?.requestNotes || batch?.notes || '—',
  }
}

function buildRowsForDept(batches, deptKey) {
  const filtered = (Array.isArray(batches) ? batches : []).filter((b) => {
    const key = matchDashboardDeptKey(b.currentDepartment || b.currentProcess || b.department || b.process)
    return key === deptKey
  })

  const byDate = new Map()
  filtered.forEach((b) => {
    const key = dateKey(b.startedAt || b.createdAt || b.updatedAt) || 'unknown'
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(b)
  })

  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  const rows = []
  sortedDates.forEach((dk) => {
    const dayBatches = byDate.get(dk) || []
    dayBatches.forEach((b, idx) => {
      rows.push(mapBatchRow(b, idx + 1))
    })
  })
  return rows
}

function groupRowsWithRowSpan(rows) {
  const groups = []
  let i = 0
  while (i < rows.length) {
    const key = rows[i].dateKey
    let span = 1
    while (i + span < rows.length && rows[i + span].dateKey === key) span += 1
    groups.push({ start: i, span, date: rows[i].date })
    i += span
  }
  return groups
}

function DeptSheet({ title, rows }) {
  const groups = useMemo(() => groupRowsWithRowSpan(rows), [rows])
  const spanAt = useMemo(() => {
    const map = new Map()
    groups.forEach((g) => map.set(g.start, g.span))
    return map
  }, [groups])

  return (
    <section>
      <h3 style={sectionTitle}>{String(title || '').toLowerCase()}</h3>
      <div style={{ overflowX: 'auto', border: '1px solid #94A3B8' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} style={thStyle}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td style={tdStyle} colSpan={COLUMNS.length}>No production rows for this department yet.</td>
              </tr>
            ) : rows.map((row, idx) => {
              const span = spanAt.get(idx)
              return (
                <tr key={row.id}>
                  {span ? (
                    <td style={tdStyle} rowSpan={span}>{row.date}</td>
                  ) : null}
                  <td style={tdStyle}>{row.batch}</td>
                  <td style={tdStyle}>{row.metalIn}</td>
                  <td style={tdStyle}>{row.metalOut}</td>
                  <td style={tdStyle}>{row.metalLoss}</td>
                  <td style={tdStyle}>{row.timeConsumed}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'pre-line' }}>{row.employees}</td>
                  <td style={tdStyle}>{row.rating}</td>
                  <td style={tdStyle}>{row.breakdown}</td>
                  <td style={tdStyle}>{row.requests}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * LoopC Operations → Production: spreadsheet-style department tables.
 */
export default function LoopCProductionSheets() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await productionControlApi.listBatches({ limit: 500 })
        const list = res?.batches || res?.items || res?.data || (Array.isArray(res) ? res : [])
        if (mounted) setBatches(Array.isArray(list) ? list : [])
      } catch (err) {
        if (mounted) {
          setBatches([])
          setError(err?.response?.data?.message || err?.message || 'Failed to load production batches')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const sheets = useMemo(
    () => DASHBOARD_DEPARTMENTS.map((dept) => ({
      key: dept.key,
      title: dept.label,
      rows: buildRowsForDept(batches, dept.key),
    })),
    [batches],
  )

  return (
    <div style={sheetWrap}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>Production</h2>
        <p style={{ margin: '0.35rem 0 0', color: '#64748B', fontSize: '0.85rem' }}>
          Department batch sheets (date, metal, time, crew, breakdown, requests).
        </p>
      </div>
      {loading ? (
        <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Loading production sheets…</div>
      ) : null}
      {error ? (
        <div style={{ color: '#B91C1C', fontSize: '0.875rem' }}>{error}</div>
      ) : null}
      {sheets.map((sheet) => (
        <DeptSheet key={sheet.key} title={sheet.title} rows={sheet.rows} />
      ))}
    </div>
  )
}

import { LOOPC_PRODUCTION_DEPARTMENTS, matchLoopcDeptKey } from './loopcProductionDepartments'

export const SHEET_COLUMNS = [
  { key: 'date', label: 'Date', align: 'left', filter: null, sortable: true },
  { key: 'batch', label: 'Batch', align: 'left', filter: null, sortable: true },
  { key: 'metalIn', label: 'Metal IN', align: 'right', filter: null, sortable: true, numeric: true },
  { key: 'metalOut', label: 'Metal OUT', align: 'right', filter: null, sortable: true, numeric: true },
  { key: 'metalLoss', label: 'Metal Loss', align: 'right', filter: null, sortable: true, numeric: true },
  { key: 'timeBatch', label: 'Time / Batch', align: 'right', filter: null, sortable: true, numeric: true },
  { key: 'batchStarted', label: 'Batch Start', align: 'left', filter: null, sortable: true },
  { key: 'batchOver', label: 'Batch Over', align: 'left', filter: null, sortable: true },
  { key: 'departmentManager', label: 'Department Manager', align: 'left', filter: null, sortable: true },
  { key: 'employee', label: 'Employee', align: 'left', filter: null, sortable: true },
  { key: 'rating', label: 'Rating', align: 'left', filter: null, sortable: true },
  { key: 'breakdown', label: 'Breakdown', align: 'left', filter: null, sortable: true },
  { key: 'requests', label: 'Requests', align: 'left', filter: null, sortable: true },
]

export const STATUS_BUCKETS = {
  Running: ['IN_PROCESS', 'QC', 'REWORK', 'IN_TRANSIT'],
  Idle: ['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'RECEIVED', 'WAITING', 'HOLD'],
  Completed: ['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED', 'SPLIT', 'QC_FAILED', 'MERGED'],
}

export const EMPTY_FILTERS = {
  title: '',
  department: '',
  dateFrom: '',
  dateTo: '',
  datePreset: '',
  employee: '',
  departmentManager: '',
  batch: '',
  status: '',
  shift: '',
  search: '',
}

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function metalInValue(batch) {
  return toNum(batch?.processInputWeight ?? batch?.issuedWeight ?? batch?.initialWeight)
}

export function metalOutValue(batch) {
  return toNum(batch?.processOutputWeight ?? batch?.receivedWeight ?? batch?.currentWeight)
}

export function metalLossValue(batch) {
  const explicit = toNum(batch?.lossWeight)
  if (explicit != null) return explicit
  const inn = metalInValue(batch)
  const out = metalOutValue(batch)
  if (inn != null && out != null) return Math.max(0, inn - out)
  return toNum(batch?.scrapWeight)
}

export function statusBucket(status) {
  const s = String(status || '').toUpperCase()
  if (STATUS_BUCKETS.Running.includes(s)) return 'Running'
  if (STATUS_BUCKETS.Completed.includes(s)) return 'Completed'
  if (STATUS_BUCKETS.Idle.includes(s)) return 'Idle'
  return s || 'Idle'
}

export function shiftFromDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const h = d.getHours()
  if (h >= 6 && h < 14) return 'Morning'
  if (h >= 14 && h < 22) return 'Afternoon'
  return 'Night'
}

export function formatDateDisplay(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function formatDateTimeDisplay(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${formatDateDisplay(d)} ${hh}:${mi}`
}

export function formatMinutes(mins) {
  if (mins == null || !Number.isFinite(mins) || mins < 0) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatWeight(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Number(value.toFixed(2))} g`
}

function batchDurationMinutes(batch) {
  const start = batch?.startedAt ? new Date(batch.startedAt) : null
  if (!start || !Number.isFinite(start.getTime())) return null
  const end = batch?.completedAt ? new Date(batch.completedAt) : new Date()
  if (!Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/** Resolve date preset into from/to ISO date strings (yyyy-mm-dd). */
export function resolveDatePreset(preset, now = new Date()) {
  const today = startOfDay(now)
  if (preset === 'today') {
    return { dateFrom: isoDate(today), dateTo: isoDate(today) }
  }
  if (preset === 'yesterday') {
    const y = new Date(today)
    y.setDate(y.getDate() - 1)
    return { dateFrom: isoDate(y), dateTo: isoDate(y) }
  }
  if (preset === 'this_week') {
    const from = new Date(today)
    const day = from.getDay()
    const diff = day === 0 ? 6 : day - 1
    from.setDate(from.getDate() - diff)
    return { dateFrom: isoDate(from), dateTo: isoDate(today) }
  }
  if (preset === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { dateFrom: isoDate(from), dateTo: isoDate(today) }
  }
  return null
}

export function isoDate(d) {
  const x = d instanceof Date ? d : new Date(d)
  if (!Number.isFinite(x.getTime())) return ''
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export function mapBatchToRow(batch) {
  const dateRaw = batch?.startedAt || batch?.createdAt || batch?.updatedAt
  const dateObj = dateRaw ? new Date(dateRaw) : null
  const duration = batchDurationMinutes(batch)
  const inn = metalInValue(batch)
  const out = metalOutValue(batch)
  const loss = metalLossValue(batch)
  const status = statusBucket(batch?.status)
  const deptKey = matchLoopcDeptKey(
    batch?.currentDepartment || batch?.currentProcess || batch?.department || batch?.process,
    batch?.status,
  )

  return {
    id: batch?._id || batch?.id || batch?.batchNumber,
    deptKey,
    employee: String(batch?.currentHolderName || '').trim() || '—',
    departmentManager: String(batch?.createdByName || '').trim() || '—',
    batch: String(batch?.batchNumber || '').trim() || '—',
    title: String(batch?.product || batch?.purpose || batch?.currentProcess || '').trim() || '—',
    metalIn: inn,
    metalOut: out,
    metalLoss: loss,
    metalInDisplay: formatWeight(inn),
    metalOutDisplay: formatWeight(out),
    metalLossDisplay: formatWeight(loss),
    timeBatch: duration,
    averageTime: duration,
    timeBatchDisplay: formatMinutes(duration),
    averageTimeDisplay: formatMinutes(duration),
    batchStarted: formatDateTimeDisplay(batch?.startedAt),
    batchOver: formatDateTimeDisplay(batch?.completedAt),
    batchStartedRaw: batch?.startedAt || null,
    batchOverRaw: batch?.completedAt || null,
    rating: batch?.rating != null && batch?.rating !== '' ? String(batch.rating) : '—',
    breakdown: String(batch?.breakdown || batch?.breakdownNotes || '').trim() || '—',
    requests: String(batch?.requests || batch?.requestNotes || batch?.notes || '').trim() || '—',
    status,
    statusRaw: batch?.status || '',
    date: formatDateDisplay(dateRaw),
    dateRaw: dateObj && Number.isFinite(dateObj.getTime()) ? dateObj : null,
    dateKey: dateObj && Number.isFinite(dateObj.getTime()) ? isoDate(dateObj) : '',
    shift: dateObj && Number.isFinite(dateObj.getTime()) ? shiftFromDate(dateObj) : '',
  }
}

export function applyGlobalFilters(rows, filters) {
  if (!filters) return rows
  const titleQ = String(filters.title || '').trim().toLowerCase()
  const batchQ = String(filters.batch || '').trim().toLowerCase()
  const searchQ = String(filters.search || '').trim().toLowerCase()
  const emp = String(filters.employee || '').trim().toLowerCase()
  const mgr = String(filters.departmentManager || '').trim().toLowerCase()
  const dept = String(filters.department || '').trim()
  const status = String(filters.status || '').trim()
  const shift = String(filters.shift || '').trim()
  let from = filters.dateFrom ? startOfDay(filters.dateFrom) : null
  let to = filters.dateTo ? endOfDay(filters.dateTo) : null
  if (from && !Number.isFinite(from.getTime())) from = null
  if (to && !Number.isFinite(to.getTime())) to = null

  return rows.filter((row) => {
    if (dept && row.deptKey !== dept) return false
    if (status && row.status !== status) return false
    if (shift && row.shift !== shift) return false
    if (emp && emp !== '—' && String(row.employee).toLowerCase() !== emp) return false
    if (mgr && mgr !== '—' && String(row.departmentManager).toLowerCase() !== mgr) return false
    if (titleQ && !String(row.title).toLowerCase().includes(titleQ)) return false
    if (batchQ && !String(row.batch).toLowerCase().includes(batchQ)) return false
    if (from || to) {
      if (!row.dateRaw) return false
      if (from && row.dateRaw < from) return false
      if (to && row.dateRaw > to) return false
    }
    if (searchQ) {
      const hay = `${row.employee} ${row.departmentManager} ${row.batch} ${row.title} ${row.status}`.toLowerCase()
      if (!hay.includes(searchQ)) return false
    }
    return true
  })
}

export function sortRows(rows, sortKey, sortDir) {
  if (!sortKey) return rows
  const col = SHEET_COLUMNS.find((c) => c.key === sortKey)
  const dir = sortDir === 'desc' ? -1 : 1
  const sorted = [...rows].sort((a, b) => {
    let av = a[sortKey]
    let bv = b[sortKey]
    if (sortKey === 'metalIn' || sortKey === 'metalOut' || sortKey === 'metalLoss'
      || sortKey === 'timeBatch' || sortKey === 'averageTime') {
      av = av == null ? -Infinity : Number(av)
      bv = bv == null ? -Infinity : Number(bv)
      return (av - bv) * dir
    }
    if (sortKey === 'date') {
      av = a.dateRaw ? a.dateRaw.getTime() : 0
      bv = b.dateRaw ? b.dateRaw.getTime() : 0
      return (av - bv) * dir
    }
    if (sortKey === 'batchStarted') {
      av = a.batchStartedRaw ? new Date(a.batchStartedRaw).getTime() : 0
      bv = b.batchStartedRaw ? new Date(b.batchStartedRaw).getTime() : 0
      return (av - bv) * dir
    }
    if (sortKey === 'batchOver') {
      av = a.batchOverRaw ? new Date(a.batchOverRaw).getTime() : 0
      bv = b.batchOverRaw ? new Date(b.batchOverRaw).getTime() : 0
      return (av - bv) * dir
    }
    av = String(av ?? '').toLowerCase()
    bv = String(bv ?? '').toLowerCase()
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  void col
  return sorted
}

export function applyColumnFilters(rows, columnFilters) {
  if (!columnFilters) return rows
  return rows.filter((row) => {
    for (const [key, value] of Object.entries(columnFilters)) {
      if (value == null || value === '') continue
      const q = String(value).trim().toLowerCase()
      if (!q) continue
      if (key === 'employee' || key === 'departmentManager' || key === 'status') {
        if (String(row[key]).toLowerCase() !== q) return false
      } else if (key === 'batch' || key === 'title' || key === 'rating' || key === 'breakdown' || key === 'requests') {
        if (!String(row[key]).toLowerCase().includes(q)) return false
      } else if (key === 'dateFrom') {
        const from = startOfDay(value)
        if (Number.isFinite(from.getTime()) && (!row.dateRaw || row.dateRaw < from)) return false
      } else if (key === 'dateTo') {
        const to = endOfDay(value)
        if (Number.isFinite(to.getTime()) && (!row.dateRaw || row.dateRaw > to)) return false
      }
    }
    return true
  })
}

export function computeSummary(rows) {
  const deptsWithRows = new Set(rows.map((r) => r.deptKey).filter(Boolean))
  const employees = new Set(
    rows.map((r) => r.employee).filter((e) => e && e !== '—'),
  )
  const batches = new Set(
    rows.map((r) => r.batch).filter((b) => b && b !== '—'),
  )
  let metalIn = 0
  let metalOut = 0
  let metalLoss = 0
  rows.forEach((r) => {
    if (Number.isFinite(r.metalIn)) metalIn += r.metalIn
    if (Number.isFinite(r.metalOut)) metalOut += r.metalOut
    if (Number.isFinite(r.metalLoss)) metalLoss += r.metalLoss
  })
  return {
    totalDepartments: deptsWithRows.size || LOOPC_PRODUCTION_DEPARTMENTS.length,
    departmentsWithData: deptsWithRows.size,
    totalEmployees: employees.size,
    totalBatches: batches.size,
    totalMetalIn: metalIn,
    totalMetalOut: metalOut,
    totalMetalLoss: metalLoss,
  }
}

export function groupStatusLabel(rows) {
  if (!rows.length) return 'Empty'
  if (rows.some((r) => r.status === 'Running')) return 'Running'
  if (rows.every((r) => r.status === 'Completed')) return 'Completed'
  if (rows.some((r) => r.status === 'Idle')) return 'Idle'
  return rows[0].status || '—'
}

export function uniqueOptions(rows, key) {
  const set = new Set()
  rows.forEach((r) => {
    const v = r[key]
    if (v && v !== '—') set.add(String(v))
  })
  return [...set].sort((a, b) => a.localeCompare(b))
}

export async function fetchAllBatches(listBatches) {
  const pageSize = 200
  const all = []
  let skip = 0
  let hasMore = true
  let guard = 0
  while (hasMore && guard < 50) {
    guard += 1
    const res = await listBatches({ limit: pageSize, skip, includeCount: 1 })
    const list = res?.batches || res?.items || res?.data || (Array.isArray(res) ? res : [])
    const chunk = Array.isArray(list) ? list : []
    all.push(...chunk)
    hasMore = Boolean(res?.hasMore) && chunk.length > 0
    if (!hasMore && chunk.length === pageSize && typeof res?.total === 'number') {
      hasMore = all.length < res.total
    }
    skip += pageSize
    if (chunk.length < pageSize) hasMore = false
  }
  return all
}

function entryDurationMinutes(entry) {
  const start = entry?.batchStartedAt ? new Date(entry.batchStartedAt) : null
  if (!start || !Number.isFinite(start.getTime())) return null
  const end = entry?.batchOverAt ? new Date(entry.batchOverAt) : new Date()
  if (!Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

/** Map OperationsProductionEntry → sheet row shape. */
export function mapEntryToRow(entry) {
  const dateKey = String(entry?.date || '').trim()
  const dateObj = dateKey ? new Date(`${dateKey}T12:00:00`) : null
  const inn = toNum(entry?.metalIn)
  const out = toNum(entry?.metalOut)
  let loss = toNum(entry?.metalLoss)
  if (loss == null && inn != null && out != null) loss = Math.max(0, inn - out)
  const duration = entryDurationMinutes(entry)
  const deptKey = String(entry?.departmentKey || '').trim() || null

  return {
    id: entry?._id || entry?.id,
    deptKey,
    employee: String(entry?.employeeName || '').trim() || '—',
    departmentManager: String(entry?.departmentManagerName || '').trim() || '—',
    batch: String(entry?.batchNumber || '').trim() || '—',
    title: '—',
    metalIn: inn,
    metalOut: out,
    metalLoss: loss,
    metalInDisplay: formatWeight(inn),
    metalOutDisplay: formatWeight(out),
    metalLossDisplay: formatWeight(loss),
    timeBatch: duration,
    averageTime: duration,
    timeBatchDisplay: formatMinutes(duration),
    averageTimeDisplay: formatMinutes(duration),
    batchStarted: formatDateTimeDisplay(entry?.batchStartedAt),
    batchOver: formatDateTimeDisplay(entry?.batchOverAt),
    batchStartedRaw: entry?.batchStartedAt || null,
    batchOverRaw: entry?.batchOverAt || null,
    rating: entry?.rating != null && entry?.rating !== '' ? String(entry.rating) : '—',
    breakdown: String(entry?.breakdown || '').trim() || '—',
    requests: String(entry?.requests || '').trim() || '—',
    status: entry?.batchOverAt ? 'Completed' : (entry?.batchStartedAt ? 'Running' : 'Idle'),
    statusRaw: '',
    date: dateObj && Number.isFinite(dateObj.getTime()) ? formatDateDisplay(dateObj) : (dateKey || '—'),
    dateRaw: dateObj && Number.isFinite(dateObj.getTime()) ? dateObj : null,
    dateKey,
    shift: dateObj && Number.isFinite(dateObj.getTime()) ? shiftFromDate(dateObj) : '',
  }
}

export async function fetchAllOperationsEntries(listEntries, params = {}) {
  const pageSize = 200
  const all = []
  let skip = 0
  let hasMore = true
  let guard = 0
  while (hasMore && guard < 50) {
    guard += 1
    const res = await listEntries({ ...params, limit: pageSize, skip, includeCount: 1 })
    const list = res?.entries || res?.items || res?.data || (Array.isArray(res) ? res : [])
    const chunk = Array.isArray(list) ? list : []
    all.push(...chunk)
    hasMore = Boolean(res?.hasMore) && chunk.length > 0
    if (!hasMore && chunk.length === pageSize && typeof res?.total === 'number') {
      hasMore = all.length < res.total
    }
    skip += pageSize
    if (chunk.length < pageSize) hasMore = false
  }
  return all
}

/** Build API payload from editable draft / row fields. */
export function rowToEntryPayload(row, departmentKey) {
  const dateKey = String(row.dateKey || '').trim()
    || (row.dateRaw instanceof Date && Number.isFinite(row.dateRaw.getTime()) ? isoDate(row.dateRaw) : '')
    || isoDate(new Date())

  const inn = toNum(row.metalIn)
  const out = toNum(row.metalOut)
  let loss = toNum(row.metalLoss)
  if (loss == null && inn != null && out != null) loss = Math.max(0, inn - out)

  const blank = (v) => {
    const s = String(v ?? '').trim()
    return !s || s === '—' ? '' : s
  }

  return {
    departmentKey,
    batchNumber: blank(row.batch),
    metalIn: inn,
    metalOut: out,
    metalLoss: loss,
    employeeName: blank(row.employee),
    departmentManagerName: blank(row.departmentManager),
    batchStartedAt: row.batchStartedRaw || null,
    batchOverAt: row.batchOverRaw || null,
    rating: blank(row.rating),
    breakdown: blank(row.breakdown),
    requests: blank(row.requests),
    date: dateKey,
  }
}

export function emptyDraftRow(departmentKey) {
  const today = isoDate(new Date())
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    _isNew: true,
    deptKey: departmentKey,
    employee: '',
    departmentManager: '',
    batch: '',
    title: '',
    metalIn: null,
    metalOut: null,
    metalLoss: null,
    metalInDisplay: '—',
    metalOutDisplay: '—',
    metalLossDisplay: '—',
    timeBatch: null,
    averageTime: null,
    timeBatchDisplay: '—',
    averageTimeDisplay: '—',
    batchStarted: '—',
    batchOver: '—',
    batchStartedRaw: null,
    batchOverRaw: null,
    rating: '',
    breakdown: '',
    requests: '',
    status: 'Idle',
    statusRaw: '',
    date: formatDateDisplay(new Date()),
    dateRaw: new Date(),
    dateKey: today,
    shift: shiftFromDate(new Date()),
  }
}


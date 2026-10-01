const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Last day of a "YYYY-MM" month as "YYYY-MM-DD". */
export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${pad(new Date(y, m, 0).getDate())}`
}

/** Quick ranges for the report, relative to the browser's today. */
export function reportPresets(today = new Date()) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const last30 = new Date(y, m, today.getDate() - 29)
  const lastMonth = new Date(y, m - 1, 1)
  return [
    { id: 'this_month', label: 'This month', groupBy: 'day', from: ymd(new Date(y, m, 1)), to: ymd(today) },
    { id: 'last_month', label: 'Last month', groupBy: 'day', from: ymd(lastMonth), to: ymd(new Date(y, m, 0)) },
    { id: 'last_30', label: 'Last 30 days', groupBy: 'day', from: ymd(last30), to: ymd(today) },
    { id: 'this_year', label: 'This year by month', groupBy: 'month', from: `${y}-01-01`, to: ymd(today) },
  ]
}

/** 135 -> "2h 15m", 0 -> "—". */
export function formatDowntime(minutes) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${pad(m)}m` : `${m}m`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-01" -> "01 Sep 2026", "2026-09" -> "Sep 2026". */
export function formatPeriod(period) {
  const [y, m, d] = String(period || '').split('-')
  const month = MONTHS[Number(m) - 1]
  if (!month) return period || ''
  return d ? `${d} ${month} ${y}` : `${month} ${y}`
}

const num = (v) => (v == null ? '' : v)
const breakdownText = (r) => (r.breakdowns ? `${r.breakdowns}${r.breakdownsNotFixed ? ` (${r.breakdownsNotFixed} not fixed)` : ''}` : '')

export const REPORT_COLUMNS = ['Batches', 'Metal In (g)', 'Metal Out (g)', 'Loss (g)', 'Loss %', 'Limit %', 'Batches above limit', 'Fine gold loss (g)', 'Breakdowns', 'Downtime']

function valuesFor(r, limit) {
  return [
    r.batches,
    num(r.batches ? r.metalIn : null),
    num(r.batches ? r.metalOut : null),
    num(r.batches ? r.loss : null),
    num(r.lossPct),
    num(limit),
    r.batches && limit != null ? r.overLimitBatches : '',
    num(r.fineLoss),
    breakdownText(r),
    r.downtimeMinutes ? formatDowntime(r.downtimeMinutes) : '',
  ]
}

/** Rows without a Metal Out sender (e.g. typed straight into the workbook with no Employee). */
export const operatorName = (name) => name || 'Not recorded'

const metalValues = (r) => [
  r.batches,
  num(r.batches ? r.metalIn : null),
  num(r.batches ? r.metalOut : null),
  num(r.batches ? r.loss : null),
  num(r.lossPct),
]

function operatorSheets(data, labelOf) {
  const limits = data?.limits || {}
  const label = data?.groupBy === 'month' ? 'Month' : 'Day'
  const summary = [
    ['Operator', 'Departments', 'Batches', 'Metal In (g)', 'Metal Out (g)', 'Loss (g)', 'Loss %', 'Batches above limit', 'Fine gold loss (g)'],
    ...(data?.byOperator || []).map((r) => [
      operatorName(r.operator),
      (r.departments || []).map(labelOf).join(', '),
      ...metalValues(r),
      r.overLimitBatches,
      num(r.fineLoss),
    ]),
  ]
  if (data?.total) summary.push(['All operators', '', ...metalValues(data.total), data.total.overLimitBatches, num(data.total.fineLoss)])
  const detail = [
    [label, 'Operator', 'Department', 'Batches', 'Metal In (g)', 'Metal Out (g)', 'Loss (g)', 'Loss %', 'Limit %', 'Batches above limit', 'Fine gold loss (g)'],
    ...(data?.rows || []).map((r) => {
      const limit = limits[r.department] ?? null
      return [
        formatPeriod(r.period),
        operatorName(r.operator),
        labelOf(r.department),
        ...metalValues(r),
        num(limit),
        limit != null ? r.overLimitBatches : '',
        num(r.fineLoss),
      ]
    }),
  ]
  return { summary, detail }
}

/** Sheets for Excel / CSV: per-department (or per-operator) summary and per-period detail. */
export function reportSheets(data, labelOf = (k) => k) {
  if (data?.view === 'operator') return operatorSheets(data, labelOf)
  const limits = data?.limits || {}
  const label = data?.groupBy === 'month' ? 'Month' : 'Day'
  const summary = [
    ['Department', ...REPORT_COLUMNS],
    ...(data?.byDepartment || []).map((r) => [labelOf(r.department), ...valuesFor(r, limits[r.department] ?? null)]),
  ]
  if (data?.total) summary.push(['All departments', ...valuesFor(data.total, null)])
  const detail = [
    [label, 'Department', ...REPORT_COLUMNS],
    ...(data?.rows || []).map((r) => [formatPeriod(r.period), labelOf(r.department), ...valuesFor(r, limits[r.department] ?? null)]),
  ]
  return { summary, detail }
}

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function htmlTable(rows, overRows = new Set()) {
  const [head, ...body] = rows
  return `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body
    .map((r, i) => `<tr${overRows.has(i) ? ' class="over"' : ''}>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`
}

/** Printable page: title, range, summary and detail tables; over-limit rows in red. */
export function reportPrintHtml(data, { labelOf = (k) => k, company = 'MG', departmentLabel = 'All departments' } = {}) {
  const { summary, detail } = reportSheets(data, labelOf)
  const byOperator = data?.view === 'operator'
  const overSummary = new Set((data?.byDepartment || []).map((r, i) => (r.overLimit ? i : -1)).filter((i) => i >= 0))
  const overDetail = new Set((data?.rows || []).map((r, i) => (r.overLimit ? i : -1)).filter((i) => i >= 0))
  const range = `${formatPeriod(data?.from)} – ${formatPeriod(data?.to)}`
  const note = byOperator
    ? 'Loss counts against the operator who sent Metal Out · Red = above the department\'s loss limit'
    : 'Red = above the department\'s loss limit'
  return `<!doctype html><html><head><meta charset="utf-8"><title>Metal loss report ${esc(range)}</title><style>
body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:24px;font-size:12px}
h1{font-size:18px;margin:0 0 4px;color:#ea580c}h2{font-size:14px;margin:22px 0 8px}
.sub{color:#6b7280;margin-bottom:12px}table{width:100%;border-collapse:collapse}
th{background:#fff7ed;color:#9a3412;text-align:left;font-size:11px;padding:6px;border-bottom:2px solid #fdba74}
td{padding:5px 6px;border-bottom:1px solid #e5e7eb}tr.over td{background:#fef2f2;color:#b91c1c;font-weight:700}
@page{size:A4 landscape;margin:10mm}
</style></head><body>
<h1>${esc(company)} — Metal loss report</h1>
<div class="sub">${esc(range)} · ${data?.groupBy === 'month' ? 'By month' : 'By day'} · ${esc(departmentLabel)} · Approved batches only · ${esc(note)}</div>
<h2>${byOperator ? 'Per operator' : 'Per department'}</h2>${htmlTable(summary, overSummary)}
<h2>${data?.groupBy === 'month' ? 'By month' : 'By day'}</h2>${htmlTable(detail, overDetail)}
</body></html>`
}

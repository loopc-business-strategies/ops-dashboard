import fs from 'fs'
import path from 'path'

function escapeCsv(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function ensureReportDir(reportDir) {
  fs.mkdirSync(reportDir, { recursive: true })
  return reportDir
}

export function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function writeCsv(filePath, rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : [])
  const lines = [cols.join(',')]
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCsv(row[c])).join(','))
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

export function writeText(filePath, text) {
  fs.writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
}

function findingsToCsvRows(findings, domainFilter) {
  return findings.items
    .filter((f) => !domainFilter || f.domain === domainFilter || f.phase?.includes(domainFilter))
    .map((f) => ({
      severity: f.severity,
      phase: f.phase,
      domain: f.domain,
      code: f.code,
      message: f.message,
      entity: JSON.stringify(f.entity || {}),
      expected: f.expected == null ? '' : f.expected,
      actual: f.actual == null ? '' : f.actual,
      difference: f.difference == null ? '' : f.difference,
    }))
}

export function writeAllReports({ reportDir, summary, details, findings }) {
  ensureReportDir(reportDir)

  const files = []
  const push = (name) => {
    files.push(path.join(reportDir, name))
    return path.join(reportDir, name)
  }

  writeJson(push('mg-reconciliation-summary.json'), summary)
  writeJson(push('mg-reconciliation-details.json'), details)

  const csvSpecs = [
    ['mg-voucher-audit.csv', 'vouchers'],
    ['mg-ledger-audit.csv', 'ledger'],
    ['mg-inventory-audit.csv', 'inventory'],
    ['mg-metal-audit.csv', 'metal'],
    ['mg-cogs-audit.csv', 'cogs'],
    ['mg-vat-audit.csv', 'vat'],
    ['mg-fx-audit.csv', 'fx'],
    ['mg-report-reconciliation.csv', 'reports'],
    ['mg-orphan-data.csv', 'orphan'],
    ['mg-duplicate-data.csv', 'duplicate'],
  ]

  for (const [name, key] of csvSpecs) {
    const rows = findingsToCsvRows(findings, key)
    // Also include phase-tagged orphans/duplicates
    const extra = findings.items.filter((f) => {
      if (key === 'orphan') return String(f.code || '').includes('ORPHAN') || f.phase === '15-orphans'
      if (key === 'duplicate') return String(f.code || '').includes('DUP') || f.phase === '16-duplicates'
      return false
    }).map((f) => ({
      severity: f.severity,
      phase: f.phase,
      domain: f.domain,
      code: f.code,
      message: f.message,
      entity: JSON.stringify(f.entity || {}),
      expected: f.expected == null ? '' : f.expected,
      actual: f.actual == null ? '' : f.actual,
      difference: f.difference == null ? '' : f.difference,
    }))
    const merged = key === 'orphan' || key === 'duplicate'
      ? [...rows, ...extra.filter((e) => !rows.some((r) => r.code === e.code && r.message === e.message))]
      : rows
    writeCsv(push(name), merged.length ? merged : [{ severity: 'INFORMATIONAL', message: 'No rows' }], [
      'severity', 'phase', 'domain', 'code', 'message', 'entity', 'expected', 'actual', 'difference',
    ])
  }

  const md = buildMarkdownReport(summary, findings)
  writeText(push('MG-ERP-RECONCILIATION-REPORT.md'), md)
  writeText(push('MG-ERP-RECONCILIATION-REPORT.html'), buildHtmlReport(summary, findings, md))

  return files
}

function buildMarkdownReport(summary, findings) {
  const lines = [
    '# MG ERP Reconciliation Report',
    '',
    `- **Database:** ${summary.database}`,
    `- **Audit timestamp:** ${summary.auditTimestamp}`,
    `- **Read-only:** ${summary.readOnly === true ? 'YES' : 'NO'}`,
    '',
    '## Summary counters',
    '',
    '```json',
    JSON.stringify(summary.counts, null, 2),
    '```',
    '',
    '## Domain status',
    '',
  ]

  for (const [domain, c] of Object.entries(summary.domainCounters || {})) {
    lines.push(`### ${domain}`)
    lines.push(`PASS: ${c.PASS} | WARNING: ${c.WARNING} | ERROR: ${c.ERROR} | CRITICAL: ${c.CRITICAL}`)
    lines.push('')
  }

  const bad = findings.discrepancies().slice(0, 200)
  lines.push('## Top discrepancies (max 200)')
  lines.push('')
  if (!bad.length) {
    lines.push('_No WARNING/ERROR/CRITICAL findings._')
  } else {
    for (const f of bad) {
      lines.push(`- **[${f.severity}]** ${f.phase} \`${f.code}\`: ${f.message}`)
    }
  }
  lines.push('')
  lines.push('---')
  lines.push('This report is audit-only. No database records were modified.')
  return lines.join('\n')
}

function buildHtmlReport(summary, findings, md) {
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const bad = findings.discrepancies().slice(0, 300)
  const rows = bad.map((f) => (
    `<tr><td>${esc(f.severity)}</td><td>${esc(f.phase)}</td><td>${esc(f.code)}</td><td>${esc(f.message)}</td></tr>`
  )).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MG ERP Reconciliation Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { font-size: 1.4rem; }
    .meta { color: #444; margin-bottom: 1.5rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
    th, td { border: 1px solid #ddd; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .CRITICAL { color: #991b1b; font-weight: 700; }
    .ERROR { color: #b91c1c; }
    .WARNING { color: #92400e; }
    pre { background: #f9fafb; padding: 1rem; overflow: auto; }
  </style>
</head>
<body>
  <h1>MG ERP Reconciliation Report</h1>
  <div class="meta">
    <div>Database: <strong>${esc(summary.database)}</strong></div>
    <div>Audit timestamp: ${esc(summary.auditTimestamp)}</div>
    <div>Read-only: <strong>${summary.readOnly === true ? 'YES' : 'NO'}</strong></div>
  </div>
  <h2>Summary counts</h2>
  <pre>${esc(JSON.stringify(summary.counts, null, 2))}</pre>
  <h2>Discrepancies</h2>
  <table>
    <thead><tr><th>Severity</th><th>Phase</th><th>Code</th><th>Message</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No WARNING/ERROR/CRITICAL findings</td></tr>'}</tbody>
  </table>
  <p><em>Audit-only. No database records were modified.</em></p>
</body>
</html>
`
}

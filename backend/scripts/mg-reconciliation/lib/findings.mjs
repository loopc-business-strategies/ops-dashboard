const SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING', 'PASS', 'INFORMATIONAL']

export function createFindings() {
  const items = []
  const counters = {
    vouchers: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    ledger: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    inventory: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    metal: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    cogs: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    vat: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    fx: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
    reports: { PASS: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 },
  }

  function bump(domain, severity) {
    if (counters[domain] && counters[domain][severity] != null) {
      counters[domain][severity] += 1
    }
  }

  function add({
    domain = 'general',
    phase = '',
    severity = 'INFORMATIONAL',
    code = '',
    message = '',
    entity = {},
    expected = null,
    actual = null,
    difference = null,
  } = {}) {
    const sev = SEVERITIES.includes(severity) ? severity : 'WARNING'
    const row = {
      domain,
      phase,
      severity: sev,
      code,
      message,
      entity,
      expected,
      actual,
      difference,
      at: new Date().toISOString(),
    }
    items.push(row)
    if (counters[domain] && ['PASS', 'WARNING', 'ERROR', 'CRITICAL'].includes(sev)) {
      bump(domain, sev)
    }
    return row
  }

  return {
    add,
    items,
    counters,
    countBySeverity(sev) {
      return items.filter((i) => i.severity === sev).length
    },
    discrepancies() {
      return items.filter((i) => ['ERROR', 'CRITICAL', 'WARNING'].includes(i.severity))
    },
  }
}

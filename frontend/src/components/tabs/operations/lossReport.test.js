import { describe, expect, it } from 'vitest'
import { formatDowntime, formatPeriod, monthEnd, reportPresets, reportPrintHtml, reportSheets } from './lossReport'

const data = {
  from: '2026-09-01',
  to: '2026-09-30',
  groupBy: 'day',
  limits: { melting: 0.5, rolling: null },
  rows: [
    { period: '2026-09-01', department: 'melting', batches: 2, metalIn: 1500, metalOut: 1489, loss: 11, lossPct: 0.73, overLimit: true, overLimitBatches: 1, fineLoss: 9.95, breakdowns: 2, breakdownsNotFixed: 1, downtimeMinutes: 90 },
    { period: '2026-09-02', department: 'rolling', batches: 1, metalIn: 200, metalOut: 199, loss: 1, lossPct: 0.5, overLimit: false, overLimitBatches: 0, fineLoss: null, breakdowns: 0, breakdownsNotFixed: 0, downtimeMinutes: 0 },
  ],
  byDepartment: [
    { department: 'melting', batches: 2, metalIn: 1500, metalOut: 1489, loss: 11, lossPct: 0.73, overLimit: true, overLimitBatches: 1, fineLoss: 9.95, breakdowns: 2, breakdownsNotFixed: 1, downtimeMinutes: 90 },
  ],
  total: { batches: 2, metalIn: 1500, metalOut: 1489, loss: 11, lossPct: 0.73, overLimitBatches: 1, fineLoss: 9.95, breakdowns: 2, breakdownsNotFixed: 1, downtimeMinutes: 90 },
}

describe('loss report helpers', () => {
  it('builds date presets from today', () => {
    const presets = reportPresets(new Date(2026, 2, 15))
    expect(presets.map((p) => [p.id, p.groupBy, p.from, p.to])).toEqual([
      ['this_month', 'day', '2026-03-01', '2026-03-15'],
      ['last_month', 'day', '2026-02-01', '2026-02-28'],
      ['last_30', 'day', '2026-02-14', '2026-03-15'],
      ['this_year', 'month', '2026-01-01', '2026-03-15'],
    ])
    expect(monthEnd('2028-02')).toBe('2028-02-29')
  })

  it('formats downtime and periods', () => {
    expect(formatDowntime(135)).toBe('2h 15m')
    expect(formatDowntime(45)).toBe('45m')
    expect(formatDowntime(0)).toBe('—')
    expect(formatPeriod('2026-09-01')).toBe('01 Sep 2026')
    expect(formatPeriod('2026-09')).toBe('Sep 2026')
  })

  it('makes summary and detail sheets for Excel / CSV', () => {
    const { summary, detail } = reportSheets(data, (k) => k.toUpperCase())
    expect(summary[1]).toEqual(['MELTING', 2, 1500, 1489, 11, 0.73, 0.5, 1, 9.95, '2 (1 not fixed)', '1h 30m'])
    expect(summary[2][0]).toBe('All departments')
    expect(detail[0].slice(0, 2)).toEqual(['Day', 'Department'])
    expect(detail[2]).toEqual(['02 Sep 2026', 'ROLLING', 1, 200, 199, 1, 0.5, '', '', '', '', ''])
  })

  it('prints with over-limit rows marked and text escaped', () => {
    const html = reportPrintHtml(data, { labelOf: (k) => (k === 'melting' ? 'Melting <A>' : k) })
    expect(html).toContain('Melting &lt;A&gt;')
    expect(html.match(/class="over"/g)).toHaveLength(2)
    expect(html).toContain('01 Sep 2026 – 30 Sep 2026')
  })
})

import { describe, expect, it } from 'vitest'
import { buildReportPdfMeta, buildReportPdfTable } from './reportExportHelpers'

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`

describe('reportPrintExport helpers', () => {
  it('builds trial balance table rows from register data', () => {
    const { head, body } = buildReportPdfTable({
      reportView: 'trial',
      reports: {
        trialBalance: {
          trialBalance: [{
            accountCode: '1000',
            accountName: 'Cash',
            accountType: 'Asset',
            debit: 100,
            credit: 0,
            net: 100,
          }],
        },
      },
      formatMoney,
    })
    expect(head[0]).toContain('Debit')
    expect(body[0][0]).toBe('1000')
    expect(body[0][3]).toBe('$100.00')
  })

  it('builds ledger drilldown title with account code', () => {
    const meta = buildReportPdfMeta({
      reportView: 'ledger',
      reports: {},
      selectedReportAccountCode: '1010',
    })
    expect(meta.title).toContain('1010')
  })
})

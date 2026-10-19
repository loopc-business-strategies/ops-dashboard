import { describe, expect, it } from 'vitest'
import { buildReportPdfMeta, buildReportPdfTable } from './reportExportHelpers'
import { buildReportPrintHtml } from './reportPrintExport'

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
    expect(meta.title).toBe('Ledger Report - 1010')
  })

  it('prints the summary as grouped sections and leaves out zero balances', async () => {
    const html = await buildReportPrintHtml({
      reportView: 'summary',
      reports: {
        trialBalance: {
          totalDebit: 10,
          totalCredit: 0,
          difference: 10,
          trialBalance: [
            { accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', debit: 10, credit: 0, net: 10 },
            { accountCode: '9000', accountName: 'Zero Account', accountType: 'Asset', debit: 0, credit: 0, net: 0 },
          ],
        },
      },
      branding: {},
      defaultBranding: {},
      user: { name: 'Nan' },
      formatMoney,
      formatMoneyAbs: formatMoney,
      formatReportDirectionalBalance: () => '',
      buildBrandingLogoTag: async () => '',
      displayCurrency: 'USD',
      baseCurrency: 'USD',
      convertAmount: (value) => Number(value || 0),
    })
    expect(html).toContain('ASSETS')
    expect(html).toContain('Gross Total')
    expect(html).toContain('Cash on Hand')
    expect(html).not.toContain('Zero Account')
    expect(html).not.toContain('<th>Type</th>')
  })
})

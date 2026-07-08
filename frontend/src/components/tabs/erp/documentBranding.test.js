import { describe, expect, test } from 'vitest'
import {
  resolveStatementPrintSettings,
  resolveVoucherPrintSettings,
} from './documentBranding'

describe('documentBranding resolvers', () => {
  const baseBranding = {
    companyName: 'LoopC Metals',
    address: 'Dubai',
    logoUrl: 'data:image/png;base64,abc',
    voucherPrint: {
      tableHeaders: { no: 'S.No' },
      signatories: [{ title: 'Receiver', name: 'Sam', visible: true }],
    },
    statementPrint: {
      title: 'Customer Statement',
      subtitle: 'Confidential',
    },
  }

  test('resolveVoucherPrintSettings is disabled outside LOOPC', () => {
    const result = resolveVoucherPrintSettings({
      reportBranding: baseBranding,
      user: { company: 'mg' },
      tenantBranding: { key: 'mg' },
    })
    expect(result.enabled).toBe(false)
    expect(result.companyName).toBe('LoopC Metals')
  })

  test('resolveVoucherPrintSettings enables LOOPC voucher print settings', () => {
    const result = resolveVoucherPrintSettings({
      reportBranding: baseBranding,
      user: { company: 'loopc' },
      tenantBranding: { key: 'loopc' },
    })
    expect(result.enabled).toBe(true)
    expect(result.voucherPrint.tableHeaders.no).toBe('S.No')
    expect(result.voucherPrint.signatories[0].name).toBe('Sam')
  })

  test('resolveStatementPrintSettings enables LOOPC statement print settings', () => {
    const result = resolveStatementPrintSettings({
      reportBranding: baseBranding,
      user: { company: 'loopc' },
      tenantBranding: { key: 'loopc' },
    })
    expect(result.enabled).toBe(true)
    expect(result.statementPrint.title).toBe('Customer Statement')
    expect(result.statementPrint.subtitle).toBe('Confidential')
  })
})

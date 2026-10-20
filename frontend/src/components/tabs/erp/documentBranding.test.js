import { describe, expect, test } from 'vitest'
import {
  resolveDocumentBranding,
  resolveStatementPrintSettings,
  resolveVoucherPrintSettings,
} from './documentBranding'
import { getTenantBranding } from '../../../config/tenantBranding'

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

  test('resolveVoucherPrintSettings enables MG voucher print settings', () => {
    const result = resolveVoucherPrintSettings({
      reportBranding: baseBranding,
      user: { company: 'mg' },
      tenantBranding: { key: 'mg' },
    })
    expect(result.enabled).toBe(true)
    expect(result.companyName).toBe('LoopC Metals')
    expect(result.voucherPrint.tableHeaders.no).toBe('S.No')
  })

  test('resolveVoucherPrintSettings enables CG voucher print settings', () => {
    const result = resolveVoucherPrintSettings({
      reportBranding: baseBranding,
      user: { company: 'cg' },
      tenantBranding: { key: 'cg' },
    })
    expect(result.enabled).toBe(true)
    expect(result.voucherPrint.tableHeaders.no).toBe('S.No')
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
    expect(result.companyName).toBe('LoopC Metals')
  })

  test('resolveDocumentBranding falls back to VB tenant logo for vouchers and statements', () => {
    const vb = getTenantBranding('vb')
    const result = resolveDocumentBranding({
      reportBranding: { companyName: '', logoUrl: '' },
      user: { company: 'vb' },
      tenantBranding: vb,
    })
    expect(result.logoUrl).toContain('/logos/vb-logo.png')
    expect(result.companyName).toBe('Venus Bullion Gold Trading L.L.C')
    expect(result.address).toMatch(/Al Dhagaya Gold Souq/)
    expect(result.phone).toBe('+971 4 286 8222')
  })

  test('resolveDocumentBranding keeps an uploaded logo over the tenant default', () => {
    const uploaded = 'data:image/png;base64,uploaded-vb'
    const result = resolveDocumentBranding({
      reportBranding: { logoUrl: uploaded },
      user: { company: 'vb' },
      tenantBranding: getTenantBranding('vb'),
    })
    expect(result.logoUrl).toBe(uploaded)
  })

  test('resolveDocumentBranding skips Ops Dashboard ERP placeholder company name', () => {
    const vb = getTenantBranding('vb')
    const result = resolveDocumentBranding({
      reportBranding: { companyName: 'Ops Dashboard ERP', logoUrl: '' },
      user: { company: 'vb' },
      tenantBranding: vb,
    })
    expect(result.companyName).toBe(vb.companyName || vb.displayName)
    expect(result.companyName).not.toBe('Ops Dashboard ERP')
  })
})

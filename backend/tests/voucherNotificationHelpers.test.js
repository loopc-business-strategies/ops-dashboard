const { describe, expect, test } = require('@jest/globals')
const {
  formatNotificationMoney,
  formatNotificationAccountLabel,
  resolveVoucherPartyLabel,
  buildVoucherWorkflowMessage,
  buildJvPostedMessage,
  buildVoucherNotificationTitle,
  MAX_NOTIFICATION_BODY,
} = require('../services/voucherNotificationHelpers')

describe('voucherNotificationHelpers', () => {
  test('formatNotificationMoney includes currency', () => {
    expect(formatNotificationMoney(12500, 'USD')).toBe('$12,500.00 USD')
  })

  test('formatNotificationAccountLabel prefers name and code', () => {
    expect(formatNotificationAccountLabel({ accountName: 'Bank USD', accountCode: '101001' }))
      .toBe('Bank USD (101001)')
  })

  test('resolveVoucherPartyLabel prefers party name over account', () => {
    const tx = {
      type: 'payment',
      voucherMeta: { partyName: 'LOOP C Creditor', partyCode: '2308' },
      creditAccountId: { accountName: 'Bank USD', accountCode: '101001' },
    }
    expect(resolveVoucherPartyLabel(tx)).toBe('LOOP C Creditor')
  })

  test('resolveVoucherPartyLabel falls back to credit account for payment', () => {
    const tx = {
      type: 'payment',
      voucherMeta: {},
      creditAccountId: { accountName: 'Bank USD', accountCode: '101001' },
    }
    expect(resolveVoucherPartyLabel(tx)).toBe('Bank USD (101001)')
  })

  test('buildVoucherWorkflowMessage formats payment posted body', () => {
    const tx = {
      type: 'payment',
      amount: 12500,
      currency: 'USD',
      voucherMeta: { vocNo: 'Pay/2026/0052', partyName: 'LOOP C Creditor' },
    }
    const message = buildVoucherWorkflowMessage(tx, { action: 'posted', actorName: 'ADMIN' })
    expect(message).toBe('Pay/2026/0052 · $12,500.00 USD to LOOP C Creditor · posted by ADMIN')
  })

  test('buildVoucherWorkflowMessage formats receipt with from party', () => {
    const tx = {
      type: 'receipt',
      amount: 500,
      currency: 'USD',
      voucherMeta: { vocNo: 'Rec/2026/0010', partyName: 'Acme Customer' },
    }
    const message = buildVoucherWorkflowMessage(tx, { action: 'approved', actorName: 'Finance' })
    expect(message).toBe('Rec/2026/0010 · $500.00 USD from Acme Customer · approved by Finance')
  })

  test('buildVoucherWorkflowMessage truncates long bodies', () => {
    const tx = {
      type: 'payment',
      amount: 1,
      currency: 'USD',
      voucherMeta: { vocNo: 'Pay/2026/0099', partyName: 'X'.repeat(300) },
    }
    const message = buildVoucherWorkflowMessage(tx, { action: 'posted', actorName: 'ADMIN' })
    expect(message.length).toBeLessThanOrEqual(MAX_NOTIFICATION_BODY)
    expect(message.endsWith('…')).toBe(true)
  })

  test('buildJvPostedMessage includes account route', () => {
    const message = buildJvPostedMessage({
      vocNo: 'Jv/2026/0020',
      amount: 3000,
      currency: 'USD',
      debitLabel: 'advance payment-payroll (620001)',
      creditLabel: 'LOOP C Creditor (2308)',
    })
    expect(message).toBe('Jv/2026/0020 · $3,000.00 USD · advance payment-payroll (620001) → LOOP C Creditor (2308)')
  })

  test('buildVoucherNotificationTitle maps voucher actions', () => {
    expect(buildVoucherNotificationTitle('voucher_posted', 'payment')).toBe('Payment posted')
    expect(buildVoucherNotificationTitle('voucher_submitted', 'receipt')).toBe('Receipt submitted')
    expect(buildVoucherNotificationTitle('jv_posted', '')).toBe('Journal posted')
  })
})

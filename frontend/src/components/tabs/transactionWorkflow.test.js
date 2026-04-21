import { describe, expect, test } from 'vitest'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from './transactionWorkflow'

describe('transaction workflow helpers', () => {
  test('formats comment kinds for comment feed labels', () => {
    expect(formatTransactionCommentKind('return_note')).toBe('return note')
    expect(formatTransactionCommentKind('comment')).toBe('comment')
  })

  test('builds bulk selection text for empty and non-empty selections', () => {
    expect(getTransactionBulkSelectionLabel([])).toBe('Select rows below to submit, approve, or post in bulk.')
    expect(getTransactionBulkSelectionLabel(['tx-1', 'tx-2'])).toBe('2 selected transaction(s)')
  })

  test('formats audit entries with labels, actor names, and status transitions', () => {
    expect(formatTransactionAuditEntry({
      action: 'reject',
      actorId: { name: 'Finance Lead' },
      fromStatus: 'approved',
      toStatus: 'rejected',
      comment: 'Duplicate source document',
    }, {
      reject: 'Rejected',
    })).toEqual({
      title: 'Rejected',
      actorName: 'Finance Lead',
      statusText: 'approved to rejected',
      comment: 'Duplicate source document',
    })
  })
})
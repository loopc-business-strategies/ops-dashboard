import { describe, expect, test } from 'vitest'
import {
  getBulkTransactionActionSuccessLabel,
  getTransactionActionSuccessLabel,
} from './useErpTransactionWorkflow'

describe('useErpTransactionWorkflow helpers', () => {
  test('getTransactionActionSuccessLabel formats single transaction actions', () => {
    expect(getTransactionActionSuccessLabel('submit')).toBe('submitted')
    expect(getTransactionActionSuccessLabel('approve')).toBe('approved')
    expect(getTransactionActionSuccessLabel('return')).toBe('returned for edit')
    expect(getTransactionActionSuccessLabel('reject')).toBe('rejected')
    expect(getTransactionActionSuccessLabel('post')).toBe('posted')
    expect(getTransactionActionSuccessLabel('archive')).toBe('archive')
  })

  test('getBulkTransactionActionSuccessLabel formats supported bulk actions', () => {
    expect(getBulkTransactionActionSuccessLabel('submit')).toBe('submitted')
    expect(getBulkTransactionActionSuccessLabel('approve')).toBe('approved')
    expect(getBulkTransactionActionSuccessLabel('post')).toBe('posted')
    expect(getBulkTransactionActionSuccessLabel('return')).toBe('return')
  })
})

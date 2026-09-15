import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  buildAccountEnquiryCacheKey,
  readAccountEnquiryCache,
  writeAccountEnquiryCache,
} from './erpAccountEnquiryCache'

describe('erpAccountEnquiryCache', () => {
  beforeEach(() => {
    const store = new Map()
    const api = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
      removeItem: (key) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index) => [...store.keys()][index] || null,
      get length() { return store.size },
    }
    vi.stubGlobal('sessionStorage', api)
  })

  test('buildAccountEnquiryCacheKey includes date window, limit, and phase', () => {
    expect(buildAccountEnquiryCacheKey('mg', '101002', {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      statementLimit: 40,
      phase: 'full',
    })).toBe('erp-account-enquiry:mg:101002:2026-02-01:2026-02-28:40:full')
  })

  test('defaults statementLimit to 40 and phase to full in cache key', () => {
    expect(buildAccountEnquiryCacheKey('mg', '101002')).toBe('erp-account-enquiry:mg:101002:::40:full')
  })

  test('cache miss when date window differs', () => {
    writeAccountEnquiryCache('mg', '101002', { account: { accountCode: '101002' } }, {
      startDate: '',
      endDate: '',
      statementLimit: 40,
      phase: 'summary',
    })
    expect(readAccountEnquiryCache('mg', '101002', {
      startDate: '2026-01-01',
      endDate: '',
      statementLimit: 40,
      phase: 'summary',
    })).toBeNull()
  })
})

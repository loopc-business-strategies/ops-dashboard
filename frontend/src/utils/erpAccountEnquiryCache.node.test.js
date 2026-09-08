import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  buildAccountEnquiryCacheKey,
  clearAccountEnquiryCache,
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

  test('buildAccountEnquiryCacheKey includes date window and limit', () => {
    expect(buildAccountEnquiryCacheKey('mg', '101002', {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      statementLimit: 500,
    })).toBe('erp-account-enquiry:mg:101002:2026-02-01:2026-02-28:500')
  })

  test('defaults statementLimit to 500 in cache key', () => {
    expect(buildAccountEnquiryCacheKey('mg', '101002')).toBe('erp-account-enquiry:mg:101002:::500')
  })

  test('cache miss when date window differs', () => {
    writeAccountEnquiryCache('mg', '101002', { account: { accountCode: '101002' } }, {
      startDate: '',
      endDate: '',
      statementLimit: 500,
    })
    expect(readAccountEnquiryCache('mg', '101002', {
      startDate: '2026-02-01',
      endDate: '',
      statementLimit: 500,
    })).toBeNull()
    expect(readAccountEnquiryCache('mg', '101002', {
      startDate: '',
      endDate: '',
      statementLimit: 500,
    })?.account?.accountCode).toBe('101002')
  })

  test('clearAccountEnquiryCache removes tenant-prefixed enquiry keys', () => {
    writeAccountEnquiryCache('mg', '101002', { account: { accountCode: '101002' } })
    writeAccountEnquiryCache('vb', '101002', { account: { accountCode: '101002' } })
    clearAccountEnquiryCache()
    expect(readAccountEnquiryCache('mg', '101002')).toBeNull()
    expect(readAccountEnquiryCache('vb', '101002')).toBeNull()
  })
})

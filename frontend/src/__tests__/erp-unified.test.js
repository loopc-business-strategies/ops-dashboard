import { describe, expect, test } from 'vitest'
import erpUnified, { ERP_SURFACE, getErpClient } from '../api/erpUnified'

describe('erpUnified', () => {
  test('routes accounting surface to erp-accounting client', () => {
    const client = getErpClient(ERP_SURFACE.ACCOUNTING)
    expect(client).toBe(erpUnified.accounting)
    expect(typeof client.getAccounts).toBe('function')
  })

  test('routes operations surface to legacy erp client', () => {
    const client = getErpClient(ERP_SURFACE.OPERATIONS)
    expect(client).toBe(erpUnified.operations)
    expect(typeof client.getSuppliers).toBe('function')
  })
})

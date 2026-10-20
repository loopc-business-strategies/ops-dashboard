import { describe, expect, it } from 'vitest'
import { currencyMasterSyncLabel } from './currencyMasterSyncLabel'

describe('currencyMasterSyncLabel', () => {
  it('uses USD/AED for Venus Bullions', () => {
    expect(currencyMasterSyncLabel('vb')).toBe('Sync USD/AED')
    expect(currencyMasterSyncLabel('VB')).toBe('Sync USD/AED')
  })

  it('uses the full multi-currency set for other tenants', () => {
    expect(currencyMasterSyncLabel('mg')).toBe('Sync USD/EUR/AED/UZS')
    expect(currencyMasterSyncLabel('cg')).toBe('Sync USD/EUR/AED/UZS')
    expect(currencyMasterSyncLabel('loopc')).toBe('Sync USD/EUR/AED/UZS')
    expect(currencyMasterSyncLabel('')).toBe('Sync USD/EUR/AED/UZS')
  })
})

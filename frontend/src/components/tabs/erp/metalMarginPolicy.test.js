import { describe, expect, test } from 'vitest'
import { shouldSuppressSpotMetalMtmForAccountEnquiry } from './metalMarginPolicy'

describe('frontend metal margin policy', () => {
  test('suppresses spot MTM for creditor/vendor liability accounts', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: 'STAFF ACCOMODATION (Creditor)',
      description: 'Auto-created payable account for vendor STAFF ACCOMODATION',
    })).toBe(true)
  })

  test('does not suppress ordinary liability accounts without creditor cues', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: 'Accrued Expenses',
      description: 'Month-end accruals',
    })).toBe(false)
  })
})

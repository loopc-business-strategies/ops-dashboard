import { describe, expect, it } from 'vitest'
import { buildNexaDashboardHref, parseIncomingDeepLink } from './dashboardDeepLink'

describe('dashboardDeepLink', () => {
  it('parses nexaops web-parity enquiry URL', () => {
    expect(parseIncomingDeepLink('nexaops://dashboard?tab=erp-enquiry&account=1000&view=statement')).toEqual({
      screen: 'erp',
      erpSubTab: 'enquiry',
      account: '1000',
      view: 'statement',
    })
  })

  it('keeps parsing legacy mgops links during migration', () => {
    expect(parseIncomingDeepLink('mgops://dashboard?tab=erp-enquiry&account=1000&view=statement')).toEqual({
      screen: 'erp',
      erpSubTab: 'enquiry',
      account: '1000',
      view: 'statement',
    })
  })

  it('parses https tenant dashboard links', () => {
    expect(parseIncomingDeepLink('https://mg.loopcstrategies.com/dashboard?tab=erp-enquiry&account=2100')).toEqual({
      screen: 'erp',
      erpSubTab: 'enquiry',
      account: '2100',
      view: undefined,
    })
  })

  it('parses bare /dashboard path as home', () => {
    expect(parseIncomingDeepLink('https://mg.loopcstrategies.com/dashboard')).toEqual({ screen: 'home' })
  })

  it('parses transactions tab deep link', () => {
    expect(parseIncomingDeepLink('nexaops://dashboard?tab=erp-transactions')).toEqual({
      screen: 'transactions',
    })
  })

  it('builds nexaops enquiry href', () => {
    expect(buildNexaDashboardHref({ account: '1000', view: 'statement' }))
      .toBe('nexaops://dashboard?tab=erp-enquiry&account=1000&view=statement')
  })
})

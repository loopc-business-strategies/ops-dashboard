import { describe, expect, it } from 'vitest'
import { buildMgopsDashboardHref, parseIncomingDeepLink } from './dashboardDeepLink'

describe('dashboardDeepLink', () => {
  it('parses web-parity enquiry URL', () => {
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
    expect(parseIncomingDeepLink('mgops://dashboard?tab=erp-transactions')).toEqual({
      screen: 'transactions',
    })
  })

  it('builds mgops enquiry href', () => {
    expect(buildMgopsDashboardHref({ account: '1000', view: 'statement' }))
      .toBe('mgops://dashboard?tab=erp-enquiry&account=1000&view=statement')
  })
})

// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LIVE_METAL_POLL_MS } from '../utils/liveMetalRates'
import { LiveMetalRatesProvider, useLiveMetalRates } from './LiveMetalRatesContext.jsx'

vi.mock('../api/erp-accounting/currencies', () => ({
  currenciesApi: {
    getLiveMetalRates: vi.fn(async () => ({
      success: true,
      live: true,
      rates: {
        goldPrice: 100,
        silverPrice: 2,
        platinumPrice: 50,
        sourceGoldPrice: 3100,
        sourceSilverPrice: 62,
        sourcePlatinumPrice: 1550,
        sourceUnit: 'TOZ',
        priceCurrency: 'USD',
        source: 'mt4-bridge',
      },
    })),
    getMetalRates: vi.fn(async () => ({ success: true, rates: {} })),
  },
}))

vi.mock('../api/erp-accounting/reports', () => ({
  reportsApi: {
    getMarketPricesStreamUrl: () => '/api/erp-accounting/reports/market-prices/stream?currency=USD&unit=toz',
  },
}))

vi.mock('../utils/realtimeSocket', () => ({
  startMetalRatesRealtime: () => () => {},
}))

function Consumer({ label }) {
  const { snapshot } = useLiveMetalRates()
  return React.createElement('div', { 'data-testid': label }, snapshot.gold)
}

describe('LiveMetalRatesProvider', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('shares one poll timer and snapshot across multiple consumers', async () => {
    const intervalSpy = vi.spyOn(window, 'setInterval')

    render(
      React.createElement(
        LiveMetalRatesProvider,
        { token: 'test-token', tenant: 'mg', enabled: true },
        React.createElement(Consumer, { label: 'topbar' }),
        React.createElement(Consumer, { label: 'erp' }),
      ),
    )

    const topbar = await screen.findByTestId('topbar')
    expect(topbar.textContent).toBe('3100')
    expect(screen.getByTestId('erp').textContent).toBe('3100')

    const pollTimers = intervalSpy.mock.calls.filter(([, delay]) => delay === LIVE_METAL_POLL_MS)
    expect(pollTimers.length).toBeGreaterThan(0)
    expect(pollTimers.length).toBeLessThanOrEqual(2)

    intervalSpy.mockRestore()
  })
})

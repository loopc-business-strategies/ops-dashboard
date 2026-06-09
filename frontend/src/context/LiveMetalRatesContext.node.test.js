// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { LIVE_METAL_POLL_MS } from '../utils/liveMetalRates'
import { LiveMetalRatesProvider, useLiveMetalRates } from './LiveMetalRatesContext.jsx'

const defaultMt4LiveResponse = {
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
}

vi.mock('../api/erp-accounting/currencies', () => ({
  currenciesApi: {
    getLiveMetalRates: vi.fn(async () => defaultMt4LiveResponse),
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

/** When EventSource is missing, LiveMetalRatesProvider calls schedulePoll twice on mount. */
class StubEventSource {
  constructor() {
    this.onopen = null
    this.onmessage = null
    this.onerror = null
  }

  close() {}
}

function Consumer({ label }) {
  const { snapshot } = useLiveMetalRates()
  return React.createElement('div', { 'data-testid': label }, snapshot.gold)
}

function HarnessWithReload({ testId = 'gold' }) {
  const { snapshot, reload } = useLiveMetalRates()
  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': testId }, snapshot.gold),
    React.createElement('button', { type: 'button', 'data-testid': 'reload-live', onClick: () => void reload() }, 'reload'),
  )
}

describe('LiveMetalRatesProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', StubEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    vi.mocked(currenciesApi.getLiveMetalRates).mockImplementation(async () => defaultMt4LiveResponse)
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

  test('GET live with feedType market overrides prior mt4-bridge snapshot', async () => {
    let call = 0
    vi.mocked(currenciesApi.getLiveMetalRates).mockImplementation(async () => {
      call += 1
      if (call === 1) {
        return {
          success: true,
          live: true,
          rates: {
            goldPrice: 1,
            silverPrice: 1,
            platinumPrice: 1,
            sourceGoldPrice: 100,
            sourceSilverPrice: 2,
            sourcePlatinumPrice: 50,
            sourceUnit: 'TOZ',
            priceCurrency: 'USD',
            source: 'mt4-bridge',
          },
        }
      }
      return {
        success: true,
        live: true,
        feedType: 'market',
        rates: {
          goldPrice: 0.1,
          silverPrice: 0.002,
          platinumPrice: 0.05,
          sourceGoldPrice: 200,
          sourceSilverPrice: 4,
          sourcePlatinumPrice: 100,
          sourceUnit: 'TOZ',
          priceCurrency: 'USD',
          source: 'market',
          updatedAt: new Date().toISOString(),
        },
      }
    })

    render(
      React.createElement(
        LiveMetalRatesProvider,
        { token: 'test-token', tenant: 'mg', enabled: true },
        React.createElement(HarnessWithReload, null),
      ),
    )

    const gold = await screen.findByTestId('gold')
    expect(gold.textContent).toBe('100')

    fireEvent.click(screen.getByTestId('reload-live'))
    await waitFor(() => expect(gold.textContent).toBe('200'))
  })

  test('GET live market rates without feedType market do not replace mt4 snapshot', async () => {
    let call = 0
    vi.mocked(currenciesApi.getLiveMetalRates).mockImplementation(async () => {
      call += 1
      if (call === 1) {
        return {
          success: true,
          live: true,
          rates: {
            goldPrice: 1,
            silverPrice: 1,
            platinumPrice: 1,
            sourceGoldPrice: 100,
            sourceSilverPrice: 2,
            sourcePlatinumPrice: 50,
            sourceUnit: 'TOZ',
            priceCurrency: 'USD',
            source: 'mt4-bridge',
          },
        }
      }
      return {
        success: true,
        live: true,
        rates: {
          goldPrice: 0.1,
          silverPrice: 0.002,
          platinumPrice: 0.05,
          sourceGoldPrice: 999,
          sourceSilverPrice: 4,
          sourcePlatinumPrice: 100,
          sourceUnit: 'TOZ',
          priceCurrency: 'USD',
          source: 'market',
          updatedAt: new Date().toISOString(),
        },
      }
    })

    render(
      React.createElement(
        LiveMetalRatesProvider,
        { token: 'test-token', tenant: 'mg', enabled: true },
        React.createElement(HarnessWithReload, null),
      ),
    )

    const gold = await screen.findByTestId('gold')
    expect(gold.textContent).toBe('100')

    fireEvent.click(screen.getByTestId('reload-live'))
    await waitFor(() => {
      expect(currenciesApi.getLiveMetalRates.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    expect(gold.textContent).toBe('100')
  })
})

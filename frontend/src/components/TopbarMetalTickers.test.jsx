// @vitest-environment jsdom

import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopbarMetalTickers from './TopbarMetalTickers'

vi.mock('../hooks/useLiveMetalRates', () => ({
  default: vi.fn(),
}))

import useLiveMetalRates from '../hooks/useLiveMetalRates'

describe('TopbarMetalTickers', () => {
  test('shows movement row when snapshot has deltas', () => {
    vi.mocked(useLiveMetalRates).mockReturnValue({
      snapshot: {
        gold: 3101.25,
        silver: 62,
        platinum: 1550,
        currency: 'USD',
        unit: 'TOZ',
        source: 'mt4-bridge',
        updatedAt: new Date().toISOString(),
        deltas: { gold: 1.25, silver: 0, platinum: 0 },
        prevSnapshot: { gold: 3100, silver: 62, platinum: 1550 },
      },
      error: { message: 'market stream offline' },
      streamWarning: { message: 'market stream offline' },
    })

    render(<TopbarMetalTickers />)
    expect(screen.getByText(/1\.25 \(\+0\.04%\)/)).toBeTruthy()
  })

  test('shows status subline on first tick without deltas', () => {
    vi.mocked(useLiveMetalRates).mockReturnValue({
      snapshot: {
        gold: 3100,
        silver: 62,
        platinum: 1550,
        currency: 'USD',
        unit: 'TOZ',
        source: 'mt4-bridge',
        updatedAt: new Date().toISOString(),
        deltas: null,
        prevSnapshot: null,
      },
      error: null,
      streamWarning: null,
    })

    render(<TopbarMetalTickers />)
    expect(screen.getAllByText(/USD\/OZ · MT4/).length).toBe(3)
  })
})

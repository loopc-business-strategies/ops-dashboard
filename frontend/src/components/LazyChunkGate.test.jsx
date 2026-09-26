import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import LazyChunkGate, { TimedChunkFallback, ChunkErrorBoundary } from './LazyChunkGate'
import { isStaleChunkError } from '../utils/staleChunkReload'

describe('TimedChunkFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows Retry after timeout instead of hanging forever', async () => {
    render(<TimedChunkFallback label="Loading vouchers..." timeoutMs={8000} />)
    expect(screen.getByText('Loading vouchers...')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(8000)
    })

    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})

describe('ChunkErrorBoundary', () => {
  test('isStaleChunkError detects dynamic import failures', () => {
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module'))).toBe(true)
  })

  test('renders Retry UI when child throws', () => {
    function Boom() {
      throw new Error('boom')
    }
    const onRetry = vi.fn()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ChunkErrorBoundary onRetry={onRetry}>
        <Boom />
      </ChunkErrorBoundary>,
    )
    spy.mockRestore()

    expect(screen.getByText('This module failed to load.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('LazyChunkGate', () => {
  test('renders children once resolved', async () => {
    render(
      <LazyChunkGate label="Loading vouchers...">
        <div>Voucher list ready</div>
      </LazyChunkGate>,
    )
    expect(await screen.findByText('Voucher list ready')).toBeTruthy()
  })
})

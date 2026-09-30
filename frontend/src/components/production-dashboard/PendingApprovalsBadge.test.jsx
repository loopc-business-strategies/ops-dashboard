import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const list = vi.fn()
const subscribe = vi.fn(() => () => {})

vi.mock('../../api/mgFloorBatchEntries', () => ({
  mgFloorBatchEntriesApi: { list: (...a) => list(...a) },
}))
vi.mock('../../utils/realtimeEventsBus', () => ({
  subscribeRealtimeEvents: (...a) => subscribe(...a),
}))

const { default: PendingApprovalsBadge, FM_APPROVALS_HREF } = await import('./PendingApprovalsBadge')

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString()

beforeEach(() => {
  list.mockReset()
  subscribe.mockClear()
})

afterEach(cleanup)

describe('PendingApprovalsBadge', () => {
  test('shows nothing while no batch is waiting', async () => {
    list.mockResolvedValue({ counts: { PENDING: 0 }, oldestPendingAt: null })
    const { container } = render(<PendingApprovalsBadge />)
    await waitFor(() => expect(list).toHaveBeenCalledWith({ status: 'PENDING', limit: 1 }))
    expect(container.innerHTML).toBe('')
    expect(subscribe).toHaveBeenCalledWith('mg', 'mg-floor:batch-entry', expect.any(Function))
  })

  test('shows the count and oldest wait, linking to the FM page', async () => {
    list.mockResolvedValue({ counts: { PENDING: 3 }, oldestPendingAt: minutesAgo(20) })
    render(<PendingApprovalsBadge />)
    const link = (await screen.findByText('3')).closest('a')
    expect(link.getAttribute('href')).toBe(FM_APPROVALS_HREF)
    expect(link.className).not.toContain('pd-pending-badge--old')
    expect(screen.getByText('oldest 20m')).toBeTruthy()
  })

  test('turns red once the oldest batch waits over an hour', async () => {
    list.mockResolvedValue({ counts: { PENDING: 1 }, oldestPendingAt: minutesAgo(95) })
    render(<PendingApprovalsBadge />)
    const age = await screen.findByText('oldest 1h 35m')
    expect(age.closest('a').className).toContain('pd-pending-badge--old')
  })

  test('renders nothing for users without approval access', async () => {
    list.mockRejectedValue({ response: { status: 403 } })
    const { container } = render(<PendingApprovalsBadge />)
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})

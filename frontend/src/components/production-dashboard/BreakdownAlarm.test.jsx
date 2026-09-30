import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const list = vi.fn()
const acknowledge = vi.fn()
const subscribe = vi.fn(() => () => {})

vi.mock('../../api/mgFloorBreakdowns', () => ({
  mgFloorBreakdownsApi: { list: (...a) => list(...a), acknowledge: (...a) => acknowledge(...a) },
}))
vi.mock('../../utils/realtimeEventsBus', () => ({
  subscribeRealtimeEvents: (...a) => subscribe(...a),
}))

const { default: BreakdownAlarm, BREAKDOWN_ALARM_MUTE_KEY } = await import('./BreakdownAlarm')

const breakdown = (id, department = 'rolling') => ({
  _id: id,
  message: 'Reported by Op Rolling.',
  metadata: { department },
  raisedByName: 'Op Rolling',
  createdAt: new Date().toISOString(),
})

beforeEach(() => {
  list.mockReset()
  acknowledge.mockReset()
  subscribe.mockClear()
  window.localStorage.removeItem(BREAKDOWN_ALARM_MUTE_KEY)
})

afterEach(cleanup)

describe('BreakdownAlarm', () => {
  test('shows nothing at all while there is no breakdown', async () => {
    list.mockResolvedValue({ breakdowns: [] })
    const { container } = render(<BreakdownAlarm />)
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
    expect(subscribe).toHaveBeenCalledWith('mg', 'mg-floor:breakdown', expect.any(Function))
  })

  test('blinks BREAKDOWN with a mute button, lists the department, and goes quiet once acknowledged', async () => {
    list.mockResolvedValueOnce({ breakdowns: [breakdown('b1')] }).mockResolvedValue({ breakdowns: [] })
    acknowledge.mockResolvedValue({ success: true })
    const onBreakdownsChange = vi.fn()
    const { container } = render(<BreakdownAlarm onBreakdownsChange={onBreakdownsChange} />)

    const light = await screen.findByText('BREAKDOWN')
    expect(light.closest('.pd-fm-alarm').className).toContain('pd-fm-alarm--breakdown')
    expect(screen.getByRole('button', { name: 'Mute Breakdown alarm' })).toBeTruthy()
    expect(onBreakdownsChange).toHaveBeenLastCalledWith([expect.objectContaining({ _id: 'b1' })])

    fireEvent.click(light)
    expect(screen.getByText('Rolling')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('b1'))
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  test('renders nothing for users who are not Floor / Production Managers', async () => {
    list.mockRejectedValue({ response: { status: 403 } })
    const { container } = render(<BreakdownAlarm />)
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })
})

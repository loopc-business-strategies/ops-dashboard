import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const list = vi.fn()
const acknowledge = vi.fn()
const subscribe = vi.fn(() => () => {})

vi.mock('../../api/mgFloorFmCalls', () => ({
  mgFloorFmCallsApi: { list: (...a) => list(...a), acknowledge: (...a) => acknowledge(...a) },
}))
vi.mock('../../utils/realtimeEventsBus', () => ({
  subscribeRealtimeEvents: (...a) => subscribe(...a),
}))

const { default: FmCallAlarm, FM_ALARM_MUTE_KEY } = await import('./FmCallAlarm')

const call = (id, department = 'melting') => ({
  _id: id,
  message: 'Operator needs assistance.',
  metadata: { department },
  raisedByName: 'Op Melting',
  createdAt: new Date().toISOString(),
})

beforeEach(() => {
  list.mockReset()
  acknowledge.mockReset()
  subscribe.mockClear()
  window.localStorage.removeItem(FM_ALARM_MUTE_KEY)
})

afterEach(cleanup)

describe('FmCallAlarm', () => {
  test('stays quiet (mute button only) when nobody is calling', async () => {
    list.mockResolvedValue({ calls: [] })
    render(<FmCallAlarm />)
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(screen.queryByText('CALL F.M')).toBeNull()
    expect(screen.getByRole('button', { name: 'Mute Call F.M alarm' })).toBeTruthy()
    expect(subscribe).toHaveBeenCalledWith('mg', 'mg-floor:fm-call', expect.any(Function))
  })

  test('shows the blinking light with the number of calls, and lists them on click', async () => {
    list.mockResolvedValue({ calls: [call('a1', 'welding_area'), call('a2')] })
    render(<FmCallAlarm />)
    const light = await screen.findByText('CALL F.M')
    expect(light.closest('button').className).toContain('pd-fm-alarm-light')
    expect(screen.getByText('2')).toBeTruthy()

    fireEvent.click(light)
    expect(screen.getByText('Welding Area')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Acknowledge' })).toHaveLength(2)
  })

  test('acknowledging removes the call and the light goes off when none are left', async () => {
    list.mockResolvedValueOnce({ calls: [call('a1')] }).mockResolvedValue({ calls: [] })
    acknowledge.mockResolvedValue({ success: true })
    render(<FmCallAlarm />)
    fireEvent.click(await screen.findByText('CALL F.M'))
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))

    await waitFor(() => expect(acknowledge).toHaveBeenCalledWith('a1'))
    await waitFor(() => expect(screen.queryByText('CALL F.M')).toBeNull())
  })

  test('mute / unmute is remembered in this browser', async () => {
    list.mockResolvedValue({ calls: [call('a1')] })
    render(<FmCallAlarm />)
    await screen.findByText('CALL F.M')

    fireEvent.click(screen.getByRole('button', { name: 'Mute Call F.M alarm' }))
    expect(window.localStorage.getItem(FM_ALARM_MUTE_KEY)).toBe('1')
    expect(screen.getByRole('button', { name: 'Unmute Call F.M alarm' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Unmute Call F.M alarm' }))
    expect(window.localStorage.getItem(FM_ALARM_MUTE_KEY)).toBe('0')
  })

  test('reports the waiting calls so the calling department card can blink', async () => {
    const calls = [call('a1', 'rolling')]
    list.mockResolvedValue({ calls })
    const onCallsChange = vi.fn()
    render(<FmCallAlarm onCallsChange={onCallsChange} />)
    await waitFor(() => expect(onCallsChange).toHaveBeenLastCalledWith(calls))
  })

  test('renders nothing for users who are not Floor / Production Managers', async () => {
    list.mockRejectedValue({ response: { status: 403 } })
    const { container } = render(<FmCallAlarm />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
})

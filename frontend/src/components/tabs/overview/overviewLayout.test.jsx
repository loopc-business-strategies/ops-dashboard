import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import OverviewTab from '../OverviewTab'

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Nan', role: 'super_admin', department: 'finance' },
    token: 'test-token',
  }),
}))

vi.mock('../../../api/projects', () => ({
  default: {
    getProjects: vi.fn(async () => ({ projects: [] })),
    createProject: vi.fn(),
    updateProject: vi.fn(),
  },
}))

vi.mock('../../../api/auth', () => ({
  default: { getUsers: vi.fn(async () => ({ users: [] })) },
}))

vi.mock('../../../api/hr', () => ({
  default: { getEmployees: vi.fn(async () => ({ employees: [] })) },
}))

vi.mock('../../../api/attendance', () => ({
  default: {
    getSummary: vi.fn(async () => ({ summary: { present: 2, total: 4 } })),
    getMyAttendance: vi.fn(async () => ({ me: { todayStatus: 'present', presentDays: 8, totalDays: 20 } })),
    getLeaveRequests: vi.fn(async () => ({ requests: [] })),
    createLeaveRequest: vi.fn(),
  },
}))

vi.mock('../../../api/messages', () => ({
  default: { getLatestMessages: vi.fn(async () => ({ messages: [] })) },
}))

vi.mock('../../../api/client', () => {
  const axios = { get: vi.fn(async () => ({ data: { exceptions: [], results: [] } })) }
  return { default: axios, API_ORIGIN: 'http://test.local' }
})

vi.mock('../../../utils/realtimeEventsBus', () => ({
  subscribeRealtimeEvents: () => () => {},
}))

describe('Workspace Overview layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders compact workspace sections without module shortcuts', async () => {
    render(
      <OverviewTab
        onNavigate={vi.fn()}
        buildTabHref={(tab) => `/?tab=${tab}`}
        isActive
      />,
    )

    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'My Work' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'My Work / Attention Required' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Quick Actions' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Notifications & Messages' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Attention Required' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Upcoming Deadlines' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Attendance & Leave' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply for Leave' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Module Shortcuts' })).toBeNull()

    await waitFor(() => {
      expect(screen.getByText('No tasks require your attention right now.')).toBeTruthy()
    })
    expect(screen.getByText('No recent activity')).toBeTruthy()
    expect(screen.getByText('No upcoming deadlines')).toBeTruthy()
  })
})

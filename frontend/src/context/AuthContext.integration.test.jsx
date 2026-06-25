import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../components/WebIdleSessionGuard', () => ({
  default: () => null,
}))

vi.mock('../utils/webPushRegister', () => ({
  ensureWebPushSubscription: vi.fn(),
  teardownWebPush: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn(() => 1), eject: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function AuthProbe() {
  const { user, company, isAuthenticated, isLoading, sessionPolicy, login } = useAuth()
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="auth">{String(isAuthenticated)}</p>
      <p data-testid="company">{company}</p>
      <p data-testid="user">{user?.name || ''}</p>
      <p data-testid="idle-timeout">{String(sessionPolicy?.idleTimeoutMinutes ?? '')}</p>
      <button type="button" onClick={() => login('Admin', 'secret123', 'mg')}>Login</button>
    </div>
  )
}

describe('AuthProvider session integration', () => {
  beforeEach(() => {
    axios.defaults.headers.common = {}
    localStorage.clear()
    window.history.pushState({}, '', '/dashboard?tenant=cg')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('restores a cookie session and pins tenant headers from the URL tenant', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        user: { id: 'u1', name: 'Casey', role: 'super_admin', company: 'loopc' },
        sessionPolicy: { idleTimeoutMinutes: 45, idleWarningMinutes: 5 },
      },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))

    expect(screen.getByTestId('auth').textContent).toBe('true')
    expect(screen.getByTestId('user').textContent).toBe('Casey')
    expect(screen.getByTestId('company').textContent).toBe('cg')
    expect(axios.defaults.headers.common['x-tenant']).toBe('cg')
    expect(axios.defaults.headers.common['x-company']).toBe('cg')
    expect(screen.getByTestId('idle-timeout').textContent).toBe('45')
  })

  test('login stores authenticated user and selected tenant headers', async () => {
    window.history.pushState({}, '', '/login')
    axios.post.mockResolvedValueOnce({
      data: {
        user: { id: 'u2', name: 'Admin', role: 'super_admin', company: 'mg' },
        sessionPolicy: { idleTimeoutMinutes: 30, idleWarningMinutes: 5 },
      },
    })

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Admin'))

    expect(screen.getByTestId('auth').textContent).toBe('true')
    expect(screen.getByTestId('company').textContent).toBe('mg')
    expect(axios.post).toHaveBeenCalledWith('/api/auth/login', { name: 'Admin', password: 'secret123', company: 'mg' }, { withCredentials: true })
    expect(axios.defaults.headers.common['x-tenant']).toBe('mg')
    expect(screen.getByTestId('idle-timeout').textContent).toBe('30')
  })
})

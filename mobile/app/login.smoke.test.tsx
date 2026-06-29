import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), isLoading: false }),
}))

vi.mock('@/src/config/tenantBranding', () => ({
  getTenantBranding: () => ({ appName: 'Nexa', displayName: 'LoopC', colors: { primary: '#000' } }),
  getLoginPreviewBranding: () => ({ appName: 'Nexa', displayName: 'LoopC' }),
}))

import LoginScreen from '../../app/login'

describe('login screen smoke', () => {
  it('renders login form fields', () => {
    render(<LoginScreen />)
    expect(screen.getByPlaceholderText(/company|username|password/i)).toBeTruthy()
  })
})

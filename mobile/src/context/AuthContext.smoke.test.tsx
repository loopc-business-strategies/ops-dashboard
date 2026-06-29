import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react-native'

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}))

vi.mock('@/src/api/client', () => ({
  apiRequest: vi.fn(),
}))

import { AuthProvider } from '@/src/context/AuthContext'

describe('AuthProvider smoke', () => {
  it('renders children inside provider', () => {
    render(
      <AuthProvider>
        <>{'auth-child'}</>
      </AuthProvider>,
    )
    expect(screen.getByText('auth-child')).toBeTruthy()
  })
})

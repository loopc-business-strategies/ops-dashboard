import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SettingsTab } from './AdminTab'
import { LanguageProvider } from '../../context/LanguageContext'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../../api/department-state', () => ({
  default: {
    getDepartmentState: vi.fn().mockResolvedValue({ state: { idleTimeoutMinutes: '30' } }),
    saveDepartmentState: vi.fn(),
  },
}))

function renderSettingsTab() {
  return render(
    <LanguageProvider>
      <SettingsTab />
    </LanguageProvider>,
  )
}

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders web idle timeout labels without ReferenceError', async () => {
    renderSettingsTab()

    await waitFor(() => {
      expect(screen.getByText('Web Idle Timeout (min)')).toBeTruthy()
    })

    expect(screen.getByText(/Web only: sign out after inactivity/i)).toBeTruthy()
    expect(screen.getByText('General Settings')).toBeTruthy()
  })
})

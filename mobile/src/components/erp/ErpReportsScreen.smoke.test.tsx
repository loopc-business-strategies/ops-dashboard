import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react-native'

vi.mock('@/src/api/client', () => ({
  apiRequest: vi.fn(async () => ({ reports: [] })),
}))

vi.mock('@/src/context/AuthContext', () => ({
  useAuth: () => ({ token: 't', user: { company: 'loopc' } }),
}))

import ErpReportsScreen from '@/src/components/erp/ErpReportsScreen'

describe('ErpReportsScreen smoke', () => {
  it('mounts ERP reports screen', () => {
    expect(() => render(<ErpReportsScreen />)).not.toThrow()
  })
})

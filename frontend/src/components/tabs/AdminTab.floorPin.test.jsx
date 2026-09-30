import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateUserForm, EditUserModal } from './AdminTab'

const auth = vi.hoisted(() => ({ company: 'mg' }))
const createUser = vi.hoisted(() => vi.fn())
const updateUserRole = vi.hoisted(() => vi.fn())

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', company: auth.company, user: { company: auth.company } }),
}))

vi.mock('../../api/auth', () => ({
  default: { createUser, updateUserRole },
}))

const worker = (overrides = {}) => ({
  _id: 'u1',
  name: 'melter.one',
  role: 'department_user',
  department: 'production',
  floorDepartment: 'melting',
  employeeCode: 'MG-104',
  ...overrides,
})

describe('AdminTab floor PIN (MG Floor)', () => {
  beforeEach(() => {
    auth.company = 'mg'
    createUser.mockReset().mockResolvedValue({ success: true })
    updateUserRole.mockReset().mockResolvedValue({ success: true })
  })

  test('new user can be created with a floor PIN; letters are stripped', async () => {
    render(<CreateUserForm token="t" onCreated={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. john.smith'), { target: { value: 'floor.op' } })
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'Password123!' } })
    fireEvent.click(screen.getByRole('radio', { name: /Super Admin/i }))
    fireEvent.change(screen.getByLabelText('Floor PIN (MG Floor)'), { target: { value: '25a80' } })
    expect(screen.getByLabelText('Floor PIN (MG Floor)').value).toBe('2580')

    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))
    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][1]).toMatchObject({ floorPin: '2580' })
  })

  test('a too-short PIN is refused before saving', async () => {
    render(<CreateUserForm token="t" onCreated={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. john.smith'), { target: { value: 'floor.op' } })
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'Password123!' } })
    fireEvent.click(screen.getByRole('radio', { name: /Super Admin/i }))
    fireEvent.change(screen.getByLabelText('Floor PIN (MG Floor)'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))
    expect(await screen.findByText('Floor PIN must be 4 to 6 digits.')).toBeTruthy()
    expect(createUser).not.toHaveBeenCalled()
  })

  test('editing shows PIN status and keeps the PIN when left blank', async () => {
    render(<EditUserModal user={worker({ floorPinSetAt: '2026-09-01T00:00:00Z' })} token="t" onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('PIN is set')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateUserRole).toHaveBeenCalledTimes(1))
    const body = updateUserRole.mock.calls[0][2]
    expect(body.floorPin).toBeUndefined()
    expect(body.clearFloorPin).toBeUndefined()
  })

  test('admin resets or clears the PIN', async () => {
    const { unmount } = render(<EditUserModal user={worker({ floorPinSetAt: '2026-09-01T00:00:00Z' })} token="t" onSave={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Floor PIN (MG Floor)'), { target: { value: '4826' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateUserRole).toHaveBeenCalledTimes(1))
    expect(updateUserRole.mock.calls[0][2]).toMatchObject({ floorPin: '4826' })
    unmount()

    render(<EditUserModal user={worker({ floorPinSetAt: '2026-09-01T00:00:00Z' })} token="t" onSave={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clear PIN' }))
    expect(screen.getByLabelText('Floor PIN (MG Floor)').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateUserRole).toHaveBeenCalledTimes(2))
    expect(updateUserRole.mock.calls[1][2]).toMatchObject({ clearFloorPin: true })
  })

  test('user without a PIN shows "No PIN yet" and no Clear option', () => {
    render(<EditUserModal user={worker()} token="t" onSave={() => {}} onClose={() => {}} />)
    expect(screen.getByText('No PIN yet')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'Clear PIN' })).toBeNull()
  })

  test('floor PIN is hidden for other tenants', () => {
    auth.company = 'cg'
    render(<CreateUserForm token="t" onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.queryByLabelText('Floor PIN (MG Floor)')).toBeNull()
  })
})

import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateUserForm } from './AdminTab'

const auth = vi.hoisted(() => ({ company: 'mg' }))
const createUser = vi.hoisted(() => vi.fn())

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', company: auth.company, user: { company: auth.company } }),
}))

vi.mock('../../api/auth', () => ({
  default: { createUser },
}))

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText('e.g. john.smith'), { target: { value: 'floor.op' } })
  fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'Password123!' } })
}

describe('AdminTab floor department (MG Floor)', () => {
  beforeEach(() => {
    createUser.mockReset()
    createUser.mockResolvedValue({ success: true })
  })

  test('MG admin assigns a floor department when creating a user', async () => {
    auth.company = 'mg'
    const onCreated = vi.fn()
    render(<CreateUserForm token="test-token" onCreated={onCreated} onCancel={() => {}} />)

    fillRequired()
    fireEvent.click(screen.getByRole('radio', { name: /Super Admin/i }))
    const select = screen.getByLabelText('Floor department (MG Floor)')
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      '', 'melting', 'casting', 'rolling', 'bangle_division', 'stamping', 'polishing', 'quality_control', 'packing',
    ])
    fireEvent.change(select, { target: { value: 'casting' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][1]).toMatchObject({ name: 'floor.op', floorDepartment: 'casting' })
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })

  test('floor department select is hidden for other tenants', () => {
    auth.company = 'cg'
    render(<CreateUserForm token="test-token" onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.queryByLabelText('Floor department (MG Floor)')).toBeNull()
  })
})

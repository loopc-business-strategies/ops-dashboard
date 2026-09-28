import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateUserForm, normalizeFloorDept } from './AdminTab'

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
      '', 'vault_room', 'melting', 'rolling', 'bangle_area', 'stamping', 'pendent_section', 'welding_area',
      'assembly', 'qc', 'finished_goods',
    ])
    fireEvent.change(select, { target: { value: 'bangle_area' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][1]).toMatchObject({ name: 'floor.op', floorDepartment: 'bangle_area' })
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
  })

  test('legacy floor departments map to workbook departments on edit', () => {
    expect(normalizeFloorDept('packing')).toBe('finished_goods')
    expect(normalizeFloorDept('bangle_division')).toBe('bangle_area')
    expect(normalizeFloorDept('casting')).toBe('')
    expect(normalizeFloorDept('qc')).toBe('qc')
  })

  test('floor department select is hidden for other tenants', () => {
    auth.company = 'cg'
    render(<CreateUserForm token="test-token" onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.queryByLabelText('Floor department (MG Floor)')).toBeNull()
  })
})

import React from 'react'
import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import DepartmentOverview from './DepartmentOverview'

const cards = [
  { key: 'melting', name: 'Melting', status: 'Running' },
  { key: 'rolling', name: 'Rolling', status: 'Completed' },
]

afterEach(cleanup)

describe('DepartmentOverview Call F.M', () => {
  test('only the calling department card blinks and shows CALL F.M instead of its status', () => {
    render(<DepartmentOverview cards={cards} suppressDemo callingDepts={{ rolling: 2 }} />)
    const rolling = screen.getByRole('heading', { name: 'Rolling' }).closest('article')
    const melting = screen.getByRole('heading', { name: 'Melting' }).closest('article')

    expect(rolling.className).toContain('pd-dept-card--calling')
    expect(rolling.textContent).toContain('CALL F.M ×2')
    expect(rolling.textContent).not.toContain('Completed')

    expect(melting.className).not.toContain('pd-dept-card--calling')
    expect(melting.textContent).toContain('Running')
  })

  test('no calls, no blinking', () => {
    render(<DepartmentOverview cards={cards} suppressDemo />)
    expect(document.querySelector('.pd-dept-card--calling')).toBeNull()
    expect(screen.queryByText(/CALL F\.M/)).toBeNull()
  })
})

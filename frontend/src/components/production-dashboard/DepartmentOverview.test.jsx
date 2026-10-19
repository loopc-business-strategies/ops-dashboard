import React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('DepartmentOverview Breakdown', () => {
  test('the broken-down department card blinks with BREAKDOWN, even over a Call F.M', () => {
    render(<DepartmentOverview cards={cards} suppressDemo callingDepts={{ rolling: 1 }} breakdownDepts={{ rolling: 1 }} />)
    const rolling = screen.getByRole('heading', { name: 'Rolling' }).closest('article')
    const melting = screen.getByRole('heading', { name: 'Melting' }).closest('article')

    expect(rolling.className).toContain('pd-dept-card--breakdown')
    expect(rolling.className).not.toContain('pd-dept-card--calling')
    expect(rolling.textContent).toContain('BREAKDOWN')
    expect(rolling.textContent).not.toContain('CALL F.M')

    expect(melting.className).not.toContain('pd-dept-card--breakdown')
    expect(melting.textContent).toContain('Running')
  })

  test('acknowledged but not fixed: MACHINE DOWN with time down, and Mark fixed does not select the card', () => {
    const down = { _id: 'b1', status: 'ACKNOWLEDGED', acknowledgedByName: 'FM Test', createdAt: new Date(Date.now() - 25 * 60000).toISOString() }
    const onMarkFixed = vi.fn()
    const onSelectDept = vi.fn()
    render(<DepartmentOverview cards={cards} suppressDemo downDepts={{ melting: down }} onMarkFixed={onMarkFixed} onSelectDept={onSelectDept} />)
    const melting = screen.getByRole('heading', { name: 'Melting' }).closest('article')
    const rolling = screen.getByRole('heading', { name: 'Rolling' }).closest('article')

    expect(melting.textContent).toContain('MACHINE DOWN')
    expect(melting.textContent).not.toContain('Running')
    expect(melting.querySelector('.pd-dept-down').textContent).toContain('Down 25m · seen by FM Test')
    fireEvent.click(screen.getByRole('button', { name: 'Mark fixed' }))
    expect(onMarkFixed).toHaveBeenCalledWith(down)
    expect(onSelectDept).not.toHaveBeenCalled()
    expect(rolling.querySelector('.pd-dept-down')).toBeNull()
  })

  test('a Call F.M on a department that is down still shows CALL F.M, with the down line kept', () => {
    const down = { _id: 'b1', status: 'ACKNOWLEDGED', createdAt: new Date().toISOString() }
    render(<DepartmentOverview cards={cards} suppressDemo callingDepts={{ melting: 1 }} downDepts={{ melting: down }} onMarkFixed={() => {}} />)
    const melting = screen.getByRole('heading', { name: 'Melting' }).closest('article')
    expect(melting.textContent).toContain('CALL F.M')
    expect(melting.textContent).not.toContain('MACHINE DOWN')
    expect(melting.querySelector('.pd-dept-down')).not.toBeNull()
  })
})

describe('DepartmentOverview loss limit', () => {
  test('a batch above the limit is red with its %, and the card says how many are over', () => {
    const lossCards = [
      {
        key: 'rolling',
        name: 'Rolling',
        status: 'Completed',
        lossRows: [
          { index: 1, label: '1', loss: 6.6, lossPct: 1.26, overLimit: true },
          { index: 2, label: '2', loss: 3, lossPct: 0.3, overLimit: false },
        ],
        lossLimitPct: 1,
        lossOverLimitCount: 1,
        lossTodayPct: 0.63,
        lossTodayOverLimit: false,
      },
      { key: 'melting', name: 'Melting', status: 'Completed', lossRows: [{ index: 1, label: '1', loss: 2, lossPct: 2 }], lossLimitPct: 5, lossOverLimitCount: 0 },
    ]
    render(<DepartmentOverview cards={lossCards} suppressDemo />)
    const rolling = screen.getByRole('heading', { name: 'Rolling' }).closest('article')
    const melting = screen.getByRole('heading', { name: 'Melting' }).closest('article')

    const over = rolling.querySelectorAll('.pd-dept-loss-row--over')
    expect(over).toHaveLength(1)
    expect(over[0].textContent).toBe('16.601.26%')
    expect(rolling.querySelector('.pd-dept-loss-limit--over').textContent).toBe('1 over 1%')

    expect(melting.querySelector('.pd-dept-loss-row--over')).toBeNull()
    expect(melting.querySelector('.pd-dept-loss-limit').textContent).toBe('Limit 5%')
  })
})

import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import DepartmentTable from './DepartmentTable'
import {
  SHEET_COLUMNS,
  computeDepartmentTotals,
  computeFineGold,
  computeSummary,
  mapEntryToRow,
  rowToEntryPayload,
} from './productionSheetUtils'

const floorEntry = {
  _id: 'a'.repeat(24),
  departmentKey: 'melting',
  date: '2026-09-28',
  batchNumber: '7',
  metalIn: 1330.7,
  metalOut: 1320.5,
  metalLoss: 10.2,
  purity: 93.48,
  fineGold: 1243.949,
  employeeName: 'Op Melting',
  departmentManagerName: 'FM Test',
  rating: '',
  breakdown: '',
  requests: '',
  source: 'mg_floor',
}

describe('Production workbook purity and MG Floor rows', () => {
  test('purity and fine gold columns follow Metal IN and Metal OUT; loss columns follow Metal Loss', () => {
    const keys = SHEET_COLUMNS.map((c) => c.key)
    expect(keys.slice(2, 11)).toEqual([
      'metalIn', 'purity', 'fineGold', 'metalOut', 'purityOut', 'fineGoldOut', 'metalLoss', 'lossPct', 'fineLoss',
    ])
    expect(computeFineGold(1000, 99.5)).toBe(995)
    expect(computeFineGold(1000, null)).toBeNull()
  })

  test('blank cells stay blank (Metal OUT not approved yet, no purity)', () => {
    const row = mapEntryToRow({ ...floorEntry, metalOut: null, metalLoss: null, purity: null, fineGold: null })
    expect(row).toMatchObject({ metalOut: null, metalLoss: null, purity: null, fineGold: null })
    expect(row.metalOutDisplay).toBe('—')
    expect(row.purityDisplay).toBe('—')
    const payload = rowToEntryPayload({ ...row, fromFloor: false }, 'melting')
    expect(payload).toMatchObject({ metalOut: null, metalLoss: null, purity: null })
  })

  test('MG Floor rows map as locked and only send the editable fields', () => {
    const row = mapEntryToRow(floorEntry)
    expect(row).toMatchObject({ fromFloor: true, purity: 93.48, fineGold: 1243.949, batch: '7' })
    expect(rowToEntryPayload({ ...row, rating: 'A', metalIn: 1 }, 'melting')).toEqual({
      rating: 'A',
      breakdown: '',
      requests: '',
    })

    const manual = mapEntryToRow({ ...floorEntry, source: 'manual' })
    expect(manual.fromFloor).toBe(false)
    expect(rowToEntryPayload(manual, 'melting')).toMatchObject({ purity: 93.48, metalIn: 1330.7, departmentKey: 'melting' })
  })

  test('table shows the MG Floor badge, blocks delete and keeps metal read-only while editing', () => {
    const onSaveRow = vi.fn()
    const onDeleteRow = vi.fn()
    render(
      <DepartmentTable
        rows={[mapEntryToRow(floorEntry)]}
        editable
        onSaveRow={onSaveRow}
        onDeleteRow={onDeleteRow}
        onAddRow={() => {}}
      />,
    )
    const row = screen.getByText('MG Floor').closest('tr')
    expect(within(row).getByText('93.48%')).toBeTruthy()
    expect(within(row).getByText('1243.95 g')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Del' }).disabled).toBe(true)

    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    expect(within(row).queryByLabelText('Purity IN %')).toBeNull()
    expect(within(row).queryByLabelText('Purity OUT %')).toBeNull()
    expect(within(row).queryByDisplayValue('1330.7')).toBeNull()
    expect(within(row).getAllByRole('textbox')).toHaveLength(3)
  })

  test('manual rows edit purity and update fine gold', () => {
    render(
      <DepartmentTable
        rows={[mapEntryToRow({ ...floorEntry, source: 'manual', metalIn: 1000, purity: null, fineGold: null })]}
        editable
        onSaveRow={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Purity IN %'), { target: { value: '91.6' } })
    expect(screen.getByText('916 g')).toBeTruthy()
  })

  test('manual rows edit Purity OUT and update Fine Gold OUT and Fine Gold Loss', () => {
    render(
      <DepartmentTable
        rows={[mapEntryToRow({ ...floorEntry, source: 'manual', metalIn: 1000, metalOut: 990, metalLoss: 10, purity: 91.6, fineGold: 916 })]}
        editable
        onSaveRow={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
      />,
    )
    const row = screen.getByRole('button', { name: 'Edit' }).closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(row).getByLabelText('Purity OUT %'), { target: { value: '91' } })
    expect(within(row).getByText('900.9 g')).toBeTruthy()
    expect(within(row).getByText('15.1 g')).toBeTruthy()
  })

  test('Loss %, Fine Gold OUT (estimated without Purity OUT) and Fine Gold Loss', () => {
    const row = mapEntryToRow(floorEntry)
    expect(row).toMatchObject({ lossPct: 0.77, fineGoldOut: 1234.403, fineGoldOutEstimated: true, fineLoss: 9.546 })

    const withOut = mapEntryToRow({ ...floorEntry, purityOut: 93, fineGoldOut: 1228.065 })
    expect(withOut).toMatchObject({ purityOut: 93, fineGoldOut: 1228.065, fineGoldOutEstimated: false, fineLoss: 15.884 })

    const running = mapEntryToRow({ ...floorEntry, metalOut: null, metalLoss: null })
    expect(running).toMatchObject({ lossPct: null, fineGoldOut: null, fineLoss: null })
  })

  test('Metal OUT above Metal IN shows as a red gain instead of 0 loss', () => {
    const entry = { ...floorEntry, metalIn: 500, metalOut: 502, metalLoss: 0 }
    expect(mapEntryToRow(entry)).toMatchObject({ metalGain: 2, lossPct: -0.4 })
    expect(mapEntryToRow(floorEntry).metalGain).toBeNull()

    render(<DepartmentTable rows={[mapEntryToRow(entry)]} />)
    const row = screen.getByText('MG Floor').closest('tr')
    expect(within(row).getByText('Gain +2 g').getAttribute('title')).toMatch(/Metal OUT is more than Metal IN/)
    expect(within(row).getByText('-0.4%').getAttribute('title')).toMatch(/check the weights/)
    expect(within(screen.getByTestId('department-total-row')).getByText(/1 gain/)).toBeTruthy()
  })

  test('a batch open for more than 12 hours is flagged as Metal Out missing', () => {
    const started = new Date(Date.now() - 13 * 60 * 60000).toISOString()
    const open = mapEntryToRow({ ...floorEntry, metalOut: null, metalLoss: null, batchStartedAt: started, batchOverAt: null })
    const recent = mapEntryToRow({
      ...floorEntry, _id: 'b'.repeat(24), batchNumber: '8', metalOut: null, metalLoss: null,
      batchStartedAt: new Date(Date.now() - 60 * 60000).toISOString(), batchOverAt: null,
    })
    render(<DepartmentTable rows={[open, recent]} />)
    expect(screen.getAllByText(/Metal Out missing\?/)).toHaveLength(1)
    expect(screen.getByText(/Metal Out missing\?/).textContent).toMatch(/^13h/)
    expect(within(screen.getByTestId('department-total-row')).getByText(/1 open over 12h/)).toBeTruthy()
  })

  test('Loss % shows red above the department loss limit', () => {
    render(<DepartmentTable rows={[mapEntryToRow(floorEntry)]} lossLimitPct={0.5} />)
    const row = screen.getByText('MG Floor').closest('tr')
    expect(within(row).getByText('0.77%').getAttribute('title')).toBe('Above the 0.5% loss limit')
  })

  test('Loss % is not red at or under the limit', () => {
    render(<DepartmentTable rows={[mapEntryToRow(floorEntry)]} lossLimitPct={1} />)
    const row = screen.getByText('MG Floor').closest('tr')
    expect(within(row).getByText('0.77%').getAttribute('title')).toBeNull()
  })

  test('department total row: sums, weighted purity, loss % over finished batches only, average time', () => {
    const rows = [
      mapEntryToRow({
        ...floorEntry,
        metalIn: 1000, metalOut: 990, metalLoss: 10, purity: 91.6, fineGold: 916,
        batchStartedAt: '2026-09-28T06:00:00Z', batchOverAt: '2026-09-28T08:00:00Z',
      }),
      mapEntryToRow({
        ...floorEntry, _id: 'b'.repeat(24), batchNumber: '8',
        metalIn: 500, metalOut: 498, metalLoss: 2, purity: 91.6, fineGold: 458,
        batchStartedAt: '2026-09-28T09:00:00Z', batchOverAt: '2026-09-28T10:00:00Z',
      }),
      mapEntryToRow({
        ...floorEntry, _id: 'c'.repeat(24), batchNumber: '9',
        metalIn: 300, metalOut: null, metalLoss: null, purity: 91.6, fineGold: 274.8,
        batchStartedAt: '2026-09-28T11:00:00Z', batchOverAt: null,
      }),
    ]
    const t = computeDepartmentTotals(rows)
    expect(t).toMatchObject({
      batches: 3,
      metalIn: 1800,
      purity: 91.6,
      fineGold: 1648.8,
      metalOut: 1488,
      purityOut: null,
      fineGoldOut: 1363.008,
      fineGoldOutEstimated: true,
      metalLoss: 12,
      lossPct: 0.8,
      fineLoss: 10.992,
      avgTime: 90,
      finishedBatches: 2,
    })

    render(<DepartmentTable rows={rows} />)
    const total = screen.getByTestId('department-total-row')
    expect(within(total).getByText('Total')).toBeTruthy()
    expect(within(total).getByText('3 batches')).toBeTruthy()
    expect(within(total).getByText('1800 g')).toBeTruthy()
    expect(within(total).getByText('0.8%')).toBeTruthy()
    expect(within(total).getByText('Avg 1h 30m')).toBeTruthy()
  })

  test('Total Batches counts the same batch number in another department or day separately', () => {
    const rows = [
      mapEntryToRow(floorEntry),
      mapEntryToRow({ ...floorEntry, _id: 'b'.repeat(24), departmentKey: 'rolling' }),
      mapEntryToRow({ ...floorEntry, _id: 'c'.repeat(24), date: '2026-09-29' }),
      mapEntryToRow({ ...floorEntry, _id: 'd'.repeat(24), batchNumber: '' }),
    ]
    expect(computeSummary(rows).totalBatches).toBe(3)
  })
})

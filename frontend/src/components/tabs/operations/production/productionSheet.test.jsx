import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import DepartmentTable from './DepartmentTable'
import { SHEET_COLUMNS, computeFineGold, mapEntryToRow, rowToEntryPayload } from './productionSheetUtils'

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
  test('Purity % and Fine Gold columns follow Metal IN', () => {
    const keys = SHEET_COLUMNS.map((c) => c.key)
    expect(keys.slice(2, 6)).toEqual(['metalIn', 'purity', 'fineGold', 'metalOut'])
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
    expect(within(row).queryByLabelText('Purity %')).toBeNull()
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
    fireEvent.change(screen.getByLabelText('Purity %'), { target: { value: '91.6' } })
    expect(screen.getByText('916 g')).toBeTruthy()
  })
})

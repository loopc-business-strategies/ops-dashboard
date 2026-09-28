import { describe, expect, test } from 'vitest'
import {
  effectiveFloorDepartment,
  floorDepartmentLabel,
  FLOOR_DEPARTMENTS,
  normalizeFloorDepartment,
} from './floorDepartments'

describe('effectiveFloorDepartment', () => {
  test('operators always use their assigned floor department', () => {
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: 'rolling', canChooseDepartment: false }),
    ).toBe('melting')
    expect(
      effectiveFloorDepartment({ floorDepartment: '', selectedDepartment: 'rolling', canChooseDepartment: false }),
    ).toBe('')
  })

  test('managers use the tablet choice, falling back to their own', () => {
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: 'rolling', canChooseDepartment: true }),
    ).toBe('rolling')
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: '', canChooseDepartment: true }),
    ).toBe('melting')
  })

  test('legacy keys map to workbook departments; retired ones are dropped', () => {
    expect(
      effectiveFloorDepartment({ floorDepartment: 'packing', selectedDepartment: '', canChooseDepartment: false }),
    ).toBe('finished_goods')
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: 'casting', canChooseDepartment: true }),
    ).toBe('melting')
  })
})

describe('workbook departments', () => {
  test('same ten departments as the Operations → Production workbook', () => {
    expect(FLOOR_DEPARTMENTS.map((d) => d.key)).toEqual([
      'vault_room',
      'melting',
      'rolling',
      'bangle_area',
      'stamping',
      'pendent_section',
      'welding_area',
      'assembly',
      'qc',
      'finished_goods',
    ])
  })

  test('normalize', () => {
    expect(normalizeFloorDepartment('bangle_division')).toBe('bangle_area')
    expect(normalizeFloorDepartment('Quality_Control')).toBe('qc')
    expect(normalizeFloorDepartment('polishing')).toBe('')
    expect(normalizeFloorDepartment(null)).toBe('')
  })

  test('labels', () => {
    expect(floorDepartmentLabel('bangle_area')).toBe('Bangle Area')
    expect(floorDepartmentLabel('bangle_division')).toBe('Bangle Area')
    expect(floorDepartmentLabel('')).toBe('')
  })
})

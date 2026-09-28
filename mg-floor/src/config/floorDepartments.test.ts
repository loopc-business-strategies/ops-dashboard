import { describe, expect, test } from 'vitest'
import { effectiveFloorDepartment, floorDepartmentLabel } from './floorDepartments'

describe('effectiveFloorDepartment', () => {
  test('operators always use their assigned floor department', () => {
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: 'casting', canChooseDepartment: false }),
    ).toBe('melting')
    expect(
      effectiveFloorDepartment({ floorDepartment: '', selectedDepartment: 'casting', canChooseDepartment: false }),
    ).toBe('')
  })

  test('managers use the tablet choice, falling back to their own', () => {
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: 'casting', canChooseDepartment: true }),
    ).toBe('casting')
    expect(
      effectiveFloorDepartment({ floorDepartment: 'melting', selectedDepartment: '', canChooseDepartment: true }),
    ).toBe('melting')
  })

  test('labels', () => {
    expect(floorDepartmentLabel('bangle_division')).toBe('Bangle')
    expect(floorDepartmentLabel('')).toBe('')
  })
})

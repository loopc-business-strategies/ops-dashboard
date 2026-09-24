import { describe, expect, test } from 'vitest'
import {
  ASSEMBLY_TABLE_COUNT,
  DASHBOARD_DEPARTMENTS,
  MATERIAL_FLOW_STEPS,
  matchDashboardDeptKey,
  parseAssemblyTableIndex,
} from './departmentConfig.js'

describe('departmentConfig', () => {
  test('dashboard departments are the ten reference names', () => {
    expect(DASHBOARD_DEPARTMENTS).toHaveLength(10)
    expect(DASHBOARD_DEPARTMENTS.map((d) => d.label)).toEqual([
      'Vault Room',
      'Melting',
      'Rolling',
      'Bangle Area',
      'Stamping',
      'Pendent Section',
      'Welding Area',
      'Assembly Area',
      'QC',
      'Finished Goods',
    ])
  })

  test('aliases map live batch departments', () => {
    expect(matchDashboardDeptKey('vault')).toBe('vault_room')
    expect(matchDashboardDeptKey('bangle_division')).toBe('bangle_area')
    expect(matchDashboardDeptKey('pendant')).toBe('pendent_section')
    expect(matchDashboardDeptKey('welding')).toBe('welding_area')
    expect(matchDashboardDeptKey('assembly_area')).toBe('assembly')
    expect(matchDashboardDeptKey('quality control')).toBe('qc')
    expect(matchDashboardDeptKey('finished goods')).toBe('finished_goods')
  })

  test('assembly tables are 1–15 and parse machine names', () => {
    expect(ASSEMBLY_TABLE_COUNT).toBe(15)
    expect(DASHBOARD_DEPARTMENTS.find((d) => d.key === 'assembly')?.tableCount).toBe(15)
    expect(parseAssemblyTableIndex('Table 7')).toBe(7)
    expect(parseAssemblyTableIndex('TBL-12')).toBe(12)
    expect(parseAssemblyTableIndex('random')).toBeNull()
  })

  test('material flow steps match reference rail', () => {
    expect(MATERIAL_FLOW_STEPS.map((s) => s.key)).toEqual([
      'vault',
      'melting',
      'rolling',
      'production',
      'qc',
      'finished',
    ])
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASSEMBLY_TABLE_COUNT,
  DASHBOARD_DEPARTMENTS,
  MATERIAL_FLOW_STEPS,
  matchDashboardDeptKey,
  parseAssemblyTableIndex,
} from './departmentConfig.js'

test('dashboard departments are the eight reference names', () => {
  assert.equal(DASHBOARD_DEPARTMENTS.length, 8)
  assert.deepEqual(
    DASHBOARD_DEPARTMENTS.map((d) => d.label),
    [
      'Vault Room',
      'Melting',
      'Rolling',
      'Bangle Area',
      'Stamping',
      'Pendent Section',
      'Welding Area',
      'Assembly Area',
    ],
  )
  assert.ok(!DASHBOARD_DEPARTMENTS.some((d) => /cast|polish|receiving|wire|finish/i.test(d.label)))
})

test('aliases map live batch departments', () => {
  assert.equal(matchDashboardDeptKey('vault'), 'vault_room')
  assert.equal(matchDashboardDeptKey('bangle_division'), 'bangle_area')
  assert.equal(matchDashboardDeptKey('pendant'), 'pendent_section')
  assert.equal(matchDashboardDeptKey('welding'), 'welding_area')
  assert.equal(matchDashboardDeptKey('assembly_area'), 'assembly')
})

test('assembly tables are 1–15 and parse machine names', () => {
  assert.equal(ASSEMBLY_TABLE_COUNT, 15)
  assert.equal(DASHBOARD_DEPARTMENTS.find((d) => d.key === 'assembly')?.tableCount, 15)
  assert.equal(parseAssemblyTableIndex('Table 7'), 7)
  assert.equal(parseAssemblyTableIndex('TBL-12'), 12)
  assert.equal(parseAssemblyTableIndex('random'), null)
})

test('material flow steps match reference rail', () => {
  assert.deepEqual(
    MATERIAL_FLOW_STEPS.map((s) => s.key),
    ['vault', 'melting', 'rolling', 'production', 'qc', 'finished'],
  )
})

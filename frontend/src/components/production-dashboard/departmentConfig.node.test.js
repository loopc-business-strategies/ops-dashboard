import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASSEMBLY_TABLE_COUNT,
  DASHBOARD_DEPARTMENTS,
  EXTENDED_DEPT_ALIASES,
  MATERIAL_FLOW_STEPS,
  isLiveStripDeptKey,
  matchDashboardDeptKey,
  parseAssemblyTableIndex,
} from './departmentConfig.js'

test('dashboard live strip is Melting through Packing', () => {
  assert.equal(DASHBOARD_DEPARTMENTS.length, 8)
  assert.deepEqual(
    DASHBOARD_DEPARTMENTS.map((d) => d.label),
    [
      'Melting',
      'Casting',
      'Rolling',
      'Bangle Division',
      'Stamping',
      'Polishing',
      'Quality Control',
      'Packing',
    ],
  )
  assert.ok(!DASHBOARD_DEPARTMENTS.some((d) => /vault|assembly|welding|pendent|receiving|wire/i.test(d.label)))
})

test('aliases map live batch departments to strip keys', () => {
  assert.equal(matchDashboardDeptKey('melting'), 'melting')
  assert.equal(matchDashboardDeptKey('cast'), 'casting')
  assert.equal(matchDashboardDeptKey('bangle_area'), 'bangle_division')
  assert.equal(matchDashboardDeptKey('qc'), 'quality_control')
  assert.equal(matchDashboardDeptKey('quality control'), 'quality_control')
  assert.equal(matchDashboardDeptKey('packaging'), 'packing')
})

test('extended operational departments still resolve without appearing on strip', () => {
  assert.equal(matchDashboardDeptKey('vault_room'), 'vault_room')
  assert.equal(matchDashboardDeptKey('pendant'), 'pendent_section')
  assert.equal(matchDashboardDeptKey('welding'), 'welding_area')
  assert.equal(matchDashboardDeptKey('assembly_area'), 'assembly')
  assert.equal(isLiveStripDeptKey('vault_room'), false)
  assert.equal(isLiveStripDeptKey('assembly'), false)
  assert.equal(isLiveStripDeptKey('melting'), true)
  assert.ok(EXTENDED_DEPT_ALIASES.some((d) => d.key === 'assembly'))
})

test('packing is not aliased to assembly', () => {
  assert.equal(matchDashboardDeptKey('packing'), 'packing')
  assert.notEqual(matchDashboardDeptKey('packing'), 'assembly')
})

test('assembly table helpers remain available', () => {
  assert.equal(ASSEMBLY_TABLE_COUNT, 15)
  assert.equal(parseAssemblyTableIndex('Table 7'), 7)
  assert.equal(parseAssemblyTableIndex('TBL-12'), 12)
  assert.equal(parseAssemblyTableIndex('random'), null)
})

test('material flow steps remain defined', () => {
  assert.deepEqual(
    MATERIAL_FLOW_STEPS.map((s) => s.key),
    ['vault', 'melting', 'rolling', 'production', 'qc', 'finished'],
  )
})

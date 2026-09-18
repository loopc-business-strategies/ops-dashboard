import { describe, expect, test } from 'vitest'
import { buildDashboardModel } from './buildDashboardModel.js'

describe('buildDashboardModel reference panels', () => {
  test('with live batches exposes metal balance, presence, vault, reconciliation, and movements', () => {
    const model = buildDashboardModel({
      summaryRes: {
        kpis: { activeBatches: 1, metalInVault: 100, metalInProduction: 50 },
        metalByDepartment: [{ department: 'melting', metalType: 'Gold', weight: 12.5 }],
        operatorsPresent: ['Alex'],
      },
      boardRes: {
        activeBatches: [{
          _id: 'b1',
          batchNumber: 'B-1',
          status: 'IN_PROCESS',
          currentDepartment: 'melting',
          currentWeight: 12.5,
          processInputWeight: 13,
          processOutputWeight: 12.5,
          startedAt: new Date().toISOString(),
        }],
      },
      widgetsRes: { operatorsPresent: ['Alex'] },
      shiftRes: { shift: { name: 'Day', startTime: '08:00', endTime: '16:00' } },
      floorSessions: { sessions: [{ _id: 's1', status: 'OPEN', name: 'Alex', loginAt: new Date().toISOString() }] },
      todayReport: { summary: { weightIn: 20, weightOut: 10, jobs: 1, completed: 0 } },
      yesterdayReport: { summary: { weightIn: 15, weightOut: 8, jobs: 1, completed: 1 } },
      employees: { employees: [{ _id: 'e1', name: 'Alex', status: 'ACTIVE', department: 'Melting' }] },
      passes: [],
      processes: [],
      me: { productionRole: 'floor_manager' },
      stockOverview: {
        overview: {
          available: { weight: 1000, count: 2 },
          newStock: { weight: 0, count: 0 },
          vaultProducts: [
            { product: 'Gold bar', metalType: 'Gold', purity: '99.5', availableWeight: 1000, totalWeight: 1000, inventoryItemId: 'i1' },
          ],
        },
      },
      alertsRes: { alerts: [{ _id: 'a1', title: 'Test', severity: 'warning', status: 'OPEN' }] },
      weightVarianceRes: {
        rows: [{
          department: 'melting',
          expectedWeight: 12.7,
          actualWeight: 12.5,
          difference: -0.2,
          overTolerance: true,
        }],
      },
      metalMovements: [{
        _id: 'm1',
        movementNumber: 'MT-1',
        batchNumber: 'B-1',
        fromDepartment: 'vault',
        toDepartment: 'melting',
        weight: 13,
        status: 'RECEIVED',
        issuedByName: 'Alex',
        createdAt: new Date().toISOString(),
      }],
    })

    expect(model.hasLiveProduction).toBe(true)
    expect(model.deptCards.find((c) => c.key === 'melting')?.metalBalance).toBe(12.5)
    expect(model.materialFlow.some((s) => s.key === 'melting' && s.metalIn != null)).toBe(true)
    expect(model.operatorPresenceRows.some((r) => r.status === 'On Duty')).toBe(true)
    expect(model.vaultLines[0].weight).toBe(1000)
    expect(model.reconciliationRows.find((r) => r.key === 'melting')?.flagged).toBe(true)
    expect(model.metalMovementRows[0].movementNumber).toBe('MT-1')
    expect(model.permissions.canFloorSession).toBe(true)
    expect(model.permissions.canResolveAlert).toBe(true)
  })

  test('empty floor blanks PCC leftovers but keeps ERP vault', () => {
    const model = buildDashboardModel({
      summaryRes: {
        kpis: { activeBatches: 0, metalInVault: 50, metalInProduction: 10 },
        openAlerts: [{ _id: 'stale', title: 'Stale alert', severity: 'warning' }],
        metalByDepartment: [{ department: 'melting', metalType: 'Gold', weight: 9 }],
      },
      boardRes: { activeBatches: [] },
      widgetsRes: { operatorsPresent: [] },
      shiftRes: { shift: { name: 'Day' } },
      floorSessions: { sessions: [] },
      todayReport: { summary: { weightIn: 5, weightOut: 2, jobs: 0, completed: 0 } },
      yesterdayReport: { summary: { weightIn: 4, weightOut: 1, jobs: 1, completed: 1 } },
      employees: {
        employees: [
          { _id: 'e1', name: 'Alex', status: 'ACTIVE', department: 'Melting' },
          { _id: 'e2', name: 'Sam', status: 'ACTIVE', department: 'Rolling' },
        ],
      },
      passes: [{ _id: 'p1', status: 'IN_TRANSIT', batchNumber: 'OLD', fromDepartment: 'vault', toDepartment: 'melting', weight: 3 }],
      processes: [],
      me: { productionRole: 'floor_manager' },
      stockOverview: {
        overview: {
          available: { weight: 0, count: 0 },
          newStock: { weight: 200, count: 1 },
          erpVault: { weight: 1500, count: 4 },
          vaultProducts: [
            { product: 'Gold 99.5', metalType: 'Gold', purity: '99.5', availableWeight: 1500, totalWeight: 1500, inventoryItemId: 'erp1' },
          ],
        },
      },
      alertsRes: { alerts: [{ _id: 'a1', title: 'Leftover', severity: 'warning', status: 'OPEN' }] },
      weightVarianceRes: {
        rows: [{ department: 'melting', expectedWeight: 10, actualWeight: 9, difference: -1, overTolerance: true }],
      },
      metalMovements: [{
        _id: 'm1',
        movementNumber: 'MT-OLD',
        batchNumber: 'OLD',
        fromDepartment: 'vault',
        toDepartment: 'melting',
        weight: 3,
        status: 'RECEIVED',
      }],
    })

    expect(model.hasLiveProduction).toBe(false)
    expect(model.batchMonitorRows).toEqual([])
    expect(model.metalMovementRows).toEqual([])
    expect(model.alertItems).toEqual([])
    expect(model.mismatchAlerts).toEqual([])
    expect(model.operatorPresenceRows).toEqual([])
    expect(model.openPasses).toEqual([])
    expect(model.deptCards.every((c) => c.status === 'Idle' && c.batchNumber == null)).toBe(true)
    expect(model.materialFlow.find((s) => s.key === 'vault')?.weight).toBe(1500)
    expect(model.materialFlow.filter((s) => s.key !== 'vault').every((s) => s.status === 'Idle')).toBe(true)
    expect(model.vaultKpi.availableWeight).toBe(1500)
    expect(model.vaultLines[0].weight).toBe(1500)
    expect(model.compactKpis.totalProductionToday).toBeNull()
    expect(model.compactKpis.underProduction).toBeNull()
    expect(model.header.status).toMatch(/Vault connected/i)
  })
})

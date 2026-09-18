import { describe, expect, test } from 'vitest'
import { buildDashboardModel } from './buildDashboardModel.js'

describe('buildDashboardModel reference panels', () => {
  test('exposes metal balance, presence, vault, reconciliation, and movements', () => {
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

    expect(model.deptCards.find((c) => c.key === 'melting')?.metalBalance).toBe(12.5)
    expect(model.materialFlow.some((s) => s.key === 'melting' && s.metalIn != null)).toBe(true)
    expect(model.operatorPresenceRows.some((r) => r.status === 'On Duty')).toBe(true)
    expect(model.vaultLines[0].weight).toBe(1000)
    expect(model.reconciliationRows.find((r) => r.key === 'melting')?.flagged).toBe(true)
    expect(model.metalMovementRows[0].movementNumber).toBe('MT-1')
    expect(model.permissions.canFloorSession).toBe(true)
    expect(model.permissions.canResolveAlert).toBe(true)
  })
})

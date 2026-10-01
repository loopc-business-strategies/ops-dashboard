import { describe, expect, test } from 'vitest'
import { applyLoopcOpsEntriesToModel } from './applyLoopcOpsEntries'
import { addDays, dayKey } from './safeMath'

const baseModel = () => ({
  hasLiveProduction: false,
  underProductionKpi: { activeBatches: 0 },
  deptCards: [{ key: 'melting', name: 'Melting', status: 'Idle' }],
  compactKpis: { vaultAvailable: 1200 },
  header: { status: 'Factory idle' },
})

const mgFloorRow = (overrides = {}) => ({
  _id: 'row-1',
  source: 'mg_floor',
  date: dayKey(),
  departmentKey: 'rolling',
  batchNumber: '1',
  metalIn: 525,
  purity: 94.76,
  fineGold: 497.5,
  metalOut: 518.4,
  metalLoss: 6.6,
  batchStartedAt: '2026-09-28T07:48:00.000Z',
  batchOverAt: '2026-09-28T07:50:00.000Z',
  employeeName: 'FM Test',
  departmentManagerName: 'Floor Test',
  ...overrides,
})

describe('applyLoopcOpsEntriesToModel (Production Dashboard from the Operations workbook)', () => {
  test('MG keeps its dashboard unchanged on a day with no workbook rows', () => {
    const model = baseModel()
    expect(applyLoopcOpsEntriesToModel(model, [], null, { keepModelWhenEmpty: true })).toBe(model)
  })

  test('LoopC with no rows still switches to idle workbook cards', () => {
    const next = applyLoopcOpsEntriesToModel(baseModel(), [])
    expect(next.sourceOfTruth).toBe('operations-entries')
    expect(next.hasLiveProduction).toBe(false)
    expect(next.deptCards.every((c) => c.status === 'Idle')).toBe(true)
  })

  test('MG Floor workbook rows fill the department card and KPI strip', () => {
    const next = applyLoopcOpsEntriesToModel(baseModel(), [mgFloorRow()], null, { keepModelWhenEmpty: true })
    expect(next.hasLiveProduction).toBe(true)
    expect(next.sourceOfTruth).toBe('operations-entries')

    const rolling = next.deptCards.find((c) => c.key === 'rolling')
    expect(rolling).toMatchObject({
      status: 'Completed',
      batchNumber: '1',
      metalIn: 525,
      metalOut: 518.4,
      metalLoss: 6.6,
      floorManager: 'Floor Test',
      employeeName: 'FM Test',
      elapsedMin: 2,
      hasData: true,
    })
    expect(next.deptCards.find((c) => c.key === 'melting')).toMatchObject({ status: 'Idle', hasData: false })

    expect(next.compactKpis).toMatchObject({
      vaultAvailable: 1200,
      totalProductionToday: 525,
      totalOutput: 518.4,
      employees: 1,
      floorManager: 'Floor Test',
    })
    expect(next.header).toMatchObject({ activeBatches: 0, totalBatches: 1 })
    expect(next.batchMonitorRows).toEqual([
      expect.objectContaining({ batchNumber: '1', departmentKey: 'rolling', qtyIn: 525, qtyOut: 518.4, status: 'Completed' }),
    ])
  })

  test('a batch with Metal IN approved but no Metal OUT yet shows as running', () => {
    const next = applyLoopcOpsEntriesToModel(
      baseModel(),
      [mgFloorRow({ metalOut: null, metalLoss: null, batchOverAt: null })],
      null,
      { keepModelWhenEmpty: true },
    )
    expect(next.deptCards.find((c) => c.key === 'rolling')).toMatchObject({ status: 'Running', metalIn: 525, metalOut: null })
    expect(next.header.activeBatches).toBe(1)
    expect(next.underProductionKpi.activeBatches).toBe(1)
    expect(next.compactKpis.underProduction).toBe(525)
  })

  test('Yesterday vs Today compares today\'s output with yesterday\'s workbook output', () => {
    const yesterday = dayKey(addDays(new Date(), -1))
    const older = dayKey(addDays(new Date(), -2))
    const prior = [
      mgFloorRow({ _id: 'y1', date: yesterday, metalOut: 300 }),
      mgFloorRow({ _id: 'y2', date: yesterday, departmentKey: 'melting', metalOut: 100 }),
      mgFloorRow({ _id: 'o1', date: older, metalOut: 5000 }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), [mgFloorRow({ metalOut: 500 })], prior, { keepModelWhenEmpty: true })
    expect(next.compactKpis.yesterdayOutput).toBe(400)
    expect(next.compactKpis.yesterdayVsToday).toBe(25)

    const noYesterday = applyLoopcOpsEntriesToModel(baseModel(), [mgFloorRow()], [prior[2]], { keepModelWhenEmpty: true })
    expect(noYesterday.compactKpis.yesterdayOutput).toBeNull()
    expect(noYesterday.compactKpis.yesterdayVsToday).toBeNull()
  })

  test('MG keeps last night\'s open batches on the cards after midnight without counting them in today\'s totals', () => {
    const yesterday = dayKey(addDays(new Date(), -1))
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const lateNight = new Date(midnight.getTime() - 60 * 60000).toISOString()
    const prior = [
      mgFloorRow({ _id: 'open', date: yesterday, batchNumber: '7', metalOut: null, metalLoss: null, batchStartedAt: lateNight, batchOverAt: null }),
      mgFloorRow({ _id: 'late', date: yesterday, departmentKey: 'melting', batchNumber: '3', batchStartedAt: lateNight, batchOverAt: new Date(midnight.getTime() + 60000).toISOString() }),
      mgFloorRow({ _id: 'done', date: yesterday, departmentKey: 'wire', batchNumber: '2', batchStartedAt: lateNight, batchOverAt: new Date(midnight.getTime() - 60000).toISOString() }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), [], prior, { keepModelWhenEmpty: true, carryOverOpen: true })

    expect(next.hasLiveProduction).toBe(true)
    expect(next.deptCards.find((c) => c.key === 'rolling')).toMatchObject({ status: 'Running', metalIn: 525, currentBatchCarriedOver: true })
    expect(next.deptCards.find((c) => c.key === 'melting').lossRows).toEqual([expect.objectContaining({ label: '3 (yesterday)' })])
    expect(next.deptCards.find((c) => c.key === 'wire')?.hasData ?? false).toBe(false)
    expect(next.header).toMatchObject({ activeBatches: 1, totalBatches: null })
    expect(next.compactKpis.totalOutput).toBeNull()
    expect(next.compactKpis.yesterdayOutput).toBe(518.4 * 2)

    const withoutOption = applyLoopcOpsEntriesToModel(baseModel(), [], prior, { keepModelWhenEmpty: true })
    expect(withoutOption.hasLiveProduction).toBe(false)
  })

  test('flags a running batch that takes more than 1.5× the usual time', () => {
    const started = new Date(Date.now() - 200 * 60000).toISOString()
    const rows = [
      mgFloorRow({ batchNumber: '4', metalOut: null, metalLoss: null, batchStartedAt: started, batchOverAt: null }),
      mgFloorRow({ _id: 'm1', departmentKey: 'melting', batchNumber: '5', metalOut: null, metalLoss: null, batchStartedAt: started, batchOverAt: null }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), rows, null, {
      keepModelWhenEmpty: true,
      timeAverages: { rolling: 120, melting: 150 },
    })
    expect(next.deptCards.find((c) => c.key === 'rolling').longRunning).toEqual({ batchNumber: '4', elapsedMin: 200, usualMin: 120 })
    expect(next.deptCards.find((c) => c.key === 'melting').longRunning).toBeNull()
    expect(applyLoopcOpsEntriesToModel(baseModel(), rows, null).deptCards.find((c) => c.key === 'rolling').longRunning).toBeNull()
  })

  test('flags batches whose loss is above the department loss limit (% of Metal In)', () => {
    const rows = [
      mgFloorRow(),
      mgFloorRow({ _id: 'row-2', batchNumber: '2', metalIn: 1000, metalOut: 997, metalLoss: 3 }),
      mgFloorRow({ _id: 'm1', departmentKey: 'melting', metalIn: 100, metalOut: 90, metalLoss: 10 }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), rows, null, { keepModelWhenEmpty: true, lossLimits: { rolling: 1 } })
    const rolling = next.deptCards.find((c) => c.key === 'rolling')
    expect(rolling.lossRows.map((r) => [r.label, r.lossPct, r.overLimit])).toEqual([['1', 1.26, true], ['2', 0.3, false]])
    expect(rolling).toMatchObject({ lossLimitPct: 1, lossOverLimitCount: 1, lossTodayPct: 0.63, lossTodayOverLimit: false })

    const melting = next.deptCards.find((c) => c.key === 'melting')
    expect(melting).toMatchObject({ lossLimitPct: null, lossOverLimitCount: 0, lossTodayOverLimit: false })
    expect(melting.lossRows[0]).toMatchObject({ lossPct: 10, overLimit: false })

    const tight = applyLoopcOpsEntriesToModel(baseModel(), rows, null, { keepModelWhenEmpty: true, lossLimits: { rolling: 0.5 } })
    expect(tight.deptCards.find((c) => c.key === 'rolling')).toMatchObject({ lossOverLimitCount: 1, lossTodayOverLimit: true })
  })

  test('the manager assigned on the tablets replaces the last approver on that department card', () => {
    const rows = [mgFloorRow(), mgFloorRow({ _id: 'm1', departmentKey: 'melting' })]
    const departmentManagers = { rolling: { id: 'u1', name: 'Ravi' } }
    const next = applyLoopcOpsEntriesToModel(baseModel(), rows, null, { keepModelWhenEmpty: true, departmentManagers })
    expect(next.deptCards.find((c) => c.key === 'rolling').floorManager).toBe('Ravi')
    expect(next.deptCards.find((c) => c.key === 'melting').floorManager).toBe('Floor Test')

    const empty = applyLoopcOpsEntriesToModel(baseModel(), [], null, {
      keepModelWhenEmpty: true,
      departmentManagers: { melting: { id: 'u1', name: 'Ravi' } },
    })
    expect(empty.deptCards).toEqual([expect.objectContaining({ key: 'melting', status: 'Idle', floorManager: 'Ravi' })])
    expect(empty.hasLiveProduction).toBe(false)
  })
})

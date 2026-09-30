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
})

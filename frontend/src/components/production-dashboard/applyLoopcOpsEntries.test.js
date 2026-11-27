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

  test('department metalInOpen counts only the Metal IN of batches still running', () => {
    const next = applyLoopcOpsEntriesToModel(
      baseModel(),
      [
        mgFloorRow({ _id: 'open', metalIn: 300, metalOut: null, metalLoss: null, batchStartedAt: new Date().toISOString(), batchOverAt: null }),
        mgFloorRow({ _id: 'done', batchNumber: '2', metalIn: 200, metalOut: 198, metalLoss: 2, batchStartedAt: new Date().toISOString(), batchOverAt: new Date().toISOString() }),
      ],
      null,
      { keepModelWhenEmpty: true },
    )
    expect(next.deptCards.find((c) => c.key === 'rolling')).toMatchObject({ metalIn: 500, metalInOpen: 300 })
    expect(next.deptCards.find((c) => c.key === 'melting')).toMatchObject({ metalInOpen: null })
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
    expect(next.deptCards.find((c) => c.key === 'melting').lossRows).toEqual([])
    expect(next.deptCards.find((c) => c.key === 'wire')?.hasData ?? false).toBe(false)
    expect(next.header).toMatchObject({ activeBatches: 1, totalBatches: null })
    expect(next.underProductionKpi.activeBatches).toBe(1)
    expect(next.compactKpis.totalOutput).toBeNull()
    expect(next.compactKpis.yesterdayOutput).toBe(518.4 * 2)

    const withoutOption = applyLoopcOpsEntriesToModel(baseModel(), [], prior, { keepModelWhenEmpty: true })
    expect(withoutOption.hasLiveProduction).toBe(false)
  })

  test('MG carries still-open gold-alloy visits older than yesterday onto the live card', () => {
    const older = dayKey(addDays(new Date(), -3))
    const started = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString()
    const meltOver = new Date(Date.now() - 3 * 24 * 60 * 60000 + 60_000).toISOString()
    const rollOver = new Date(Date.now() - 3 * 24 * 60 * 60000 + 120_000).toISOString()
    const prior = [
      mgFloorRow({
        _id: 'bmg-vault',
        source: 'gold_alloy',
        alloyMixCode: 'BMG-0001',
        date: older,
        departmentKey: 'vault_room',
        batchNumber: 'BMG-0001',
        metalIn: 552.304,
        metalOut: 552.304,
        metalLoss: 0,
        transferFromDepartment: 'post_mix',
        transferToDepartment: 'melting',
        batchStartedAt: started,
        batchOverAt: meltOver,
      }),
      mgFloorRow({
        _id: 'bmg-melt-done',
        source: 'gold_alloy',
        alloyMixCode: 'BMG-0001',
        date: older,
        departmentKey: 'melting',
        batchNumber: 'BMG-0001',
        metalIn: 552.304,
        metalOut: 551.61,
        metalLoss: 0.694,
        batchStartedAt: started,
        batchOverAt: meltOver,
      }),
      mgFloorRow({
        _id: 'bmg-roll-done',
        source: 'gold_alloy',
        alloyMixCode: 'BMG-0001',
        date: older,
        departmentKey: 'rolling',
        batchNumber: 'BMG-0001',
        metalIn: 551.61,
        metalOut: 551.51,
        metalLoss: 0.1,
        batchStartedAt: meltOver,
        batchOverAt: rollOver,
      }),
      mgFloorRow({
        _id: 'bmg-open',
        source: 'gold_alloy',
        alloyMixCode: 'BMG-0001',
        date: older,
        departmentKey: 'bangle_area',
        batchNumber: 'BMG-0001',
        metalIn: 551.51,
        metalOut: null,
        metalLoss: null,
        batchStartedAt: rollOver,
        batchOverAt: null,
      }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), [], prior, { keepModelWhenEmpty: true, carryOverOpen: true })

    expect(next.deptCards.find((c) => c.key === 'bangle_area')).toMatchObject({
      status: 'Running',
      metalIn: 551.51,
      metalOut: null,
      currentBatchCarriedOver: true,
      hasData: true,
    })
    expect(next.deptCards.find((c) => c.key === 'melting')).toMatchObject({
      status: 'Completed',
      metalIn: 552.304,
      metalOut: 551.61,
      metalLoss: null,
      lossRows: [],
      hasData: true,
    })
    expect(next.deptCards.find((c) => c.key === 'rolling')).toMatchObject({
      status: 'Completed',
      metalIn: 551.61,
      metalOut: 551.51,
      metalLoss: null,
      lossRows: [],
      hasData: true,
    })
    expect(next.deptCards.find((c) => c.key === 'vault_room')).toMatchObject({
      status: 'Completed',
      hasData: true,
      metalLoss: null,
      lossRows: [],
    })
    expect(next.header.activeBatches).toBe(1)
    expect(next.underProductionKpi.activeBatches).toBe(1)
    expect(next.batchMonitorRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        batchNumber: 'BMG-0001',
        departmentKey: 'bangle_area',
        status: 'Running',
        qtyIn: 551.51,
        carriedOver: true,
      }),
      expect.objectContaining({
        batchNumber: 'BMG-0001',
        departmentKey: 'melting',
        status: 'Completed',
        qtyIn: 552.304,
        qtyOut: 551.61,
        metalLoss: 0.694,
      }),
    ]))
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

  test('Gold Alloy Vault hops collapse to one mix — Metal IN is Post Mix, not 552+551.61+551.51', () => {
    const t0 = '2026-11-24T04:40:00.000Z'
    const t1 = '2026-11-24T04:50:00.000Z'
    const t2 = '2026-11-24T05:00:00.000Z'
    const alloy = (overrides) => ({
      source: 'gold_alloy',
      date: dayKey(),
      alloyMixCode: 'BMG-0001',
      batchNumber: 'BMG-0001',
      employeeName: 'Nan',
      departmentManagerName: 'Nan',
      ...overrides,
    })
    const rows = [
      alloy({
        _id: 'v1',
        departmentKey: 'vault_room',
        transferFromDepartment: 'post_mix',
        transferToDepartment: 'melting',
        metalIn: 552.304,
        metalOut: 552.304,
        metalLoss: 0,
        batchStartedAt: t0,
        batchOverAt: t0,
      }),
      alloy({
        _id: 'm1',
        departmentKey: 'melting',
        transferFromDepartment: 'vault_room',
        transferToDepartment: 'vault_room',
        metalIn: 552.304,
        metalOut: 551.61,
        metalLoss: 0.694,
        batchStartedAt: t0,
        batchOverAt: t1,
      }),
      alloy({
        _id: 'v2',
        departmentKey: 'vault_room',
        transferFromDepartment: 'melting',
        transferToDepartment: 'rolling',
        metalIn: 551.61,
        metalOut: 551.61,
        metalLoss: 0,
        batchStartedAt: t1,
        batchOverAt: t1,
      }),
      alloy({
        _id: 'r1',
        departmentKey: 'rolling',
        transferFromDepartment: 'vault_room',
        transferToDepartment: 'vault_room',
        metalIn: 551.61,
        metalOut: 551.51,
        metalLoss: 0.1,
        batchStartedAt: t1,
        batchOverAt: t2,
      }),
      alloy({
        _id: 'v3',
        departmentKey: 'vault_room',
        transferFromDepartment: 'rolling',
        transferToDepartment: 'bangle_area',
        metalIn: 551.51,
        metalOut: 551.51,
        metalLoss: 0,
        batchStartedAt: t2,
        batchOverAt: t2,
      }),
      alloy({
        _id: 'b1',
        departmentKey: 'bangle_area',
        transferFromDepartment: 'vault_room',
        metalIn: 551.51,
        metalOut: null,
        metalLoss: null,
        batchStartedAt: t2,
        batchOverAt: null,
      }),
    ]
    const next = applyLoopcOpsEntriesToModel(baseModel(), rows, null, { keepModelWhenEmpty: true })
    const vault = next.deptCards.find((c) => c.key === 'vault_room')
    expect(vault).toMatchObject({
      metalIn: 552.304,
      metalOut: 551.51,
      metalLoss: 0.794,
      activeBatchCount: 1,
      hasData: true,
    })
    expect(vault.lossRows).toEqual([
      expect.objectContaining({ label: 'BMG-0001', loss: 0.794 }),
    ])
    expect(vault.metalIn + vault.metalIn).not.toBe(1655.424)
    expect(next.deptCards.find((c) => c.key === 'melting')).toMatchObject({
      metalIn: 552.304,
      metalOut: 551.61,
      metalLoss: 0.694,
      activeBatchCount: 1,
    })
    expect(next.deptCards.find((c) => c.key === 'rolling')).toMatchObject({
      metalIn: 551.61,
      metalOut: 551.51,
      metalLoss: 0.1,
      activeBatchCount: 1,
    })
    expect(next.deptCards.find((c) => c.key === 'bangle_area')).toMatchObject({
      metalIn: 551.51,
      metalOut: null,
      status: 'Running',
      activeBatchCount: 1,
    })
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

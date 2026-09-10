import { describe, expect, test } from 'vitest'
import { createDemoPccApi, createDemoWorkOrdersApi, DEMO_WRITE_MSG } from './demoApi'
import { isProductionDemoEnabled } from './flags'
import { getDemoLiveFloor, DEMO_BATCHES, DEMO_WORK_ORDERS } from './productionDemoData'

describe('PCC demo isolation', () => {
  test('demo live floor returns populated KPIs and board without network', async () => {
    const api = createDemoPccApi()
    const floor = await api.getLiveFloor()
    expect(floor.kpis.activeBatches).toBeGreaterThan(0)
    expect(floor.board.QUEUED || floor.board.IN_PROGRESS || floor.board.QC).toBeTruthy()
    expect(Object.values(floor.board).flat().length).toBeGreaterThan(0)
  })

  test('demo write methods never throw network errors and mark demo', async () => {
    const api = createDemoPccApi()
    const hold = await api.holdBatch('demo-batch-001', {})
    expect(hold.demo).toBe(true)
    expect(hold.message).toBe(DEMO_WRITE_MSG)

    const woApi = createDemoWorkOrdersApi()
    const archived = await woApi.deleteWorkOrder('demo-wo-0142')
    expect(archived.demo).toBe(true)
  })

  test('demo work orders and batches are realistic and non-empty', async () => {
    const woApi = createDemoWorkOrdersApi()
    const pcc = createDemoPccApi()
    const wos = await woApi.getWorkOrders({ page: 1, limit: 20 })
    const batches = await pcc.listBatches({ limit: 50 })
    expect(wos.workOrders.length).toBeGreaterThan(0)
    expect(wos.workOrders[0].woNumber).toMatch(/^WO-2026-/)
    expect(batches.batches.length).toBeGreaterThan(0)
    expect(batches.batches[0].batchNumber).toMatch(/^B-/)
    expect(DEMO_WORK_ORDERS.length).toBeGreaterThanOrEqual(5)
    expect(DEMO_BATCHES.length).toBeGreaterThanOrEqual(6)
  })

  test('demo batch detail resolves for known id', async () => {
    const api = createDemoPccApi()
    const detail = await api.getBatch(DEMO_BATCHES[0]._id)
    expect(detail.batch.batchNumber).toBe(DEMO_BATCHES[0].batchNumber)
    expect(detail.weightReconciliation).toBeDefined()
  })

  test('getDemoLiveFloor matches adapter shape', () => {
    const floor = getDemoLiveFloor()
    expect(floor.kpis.scrapTotal).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(floor.custody)).toBe(true)
  })
})

describe('PCC demo feature flag', () => {
  test('isProductionDemoEnabled is a boolean from env', () => {
    expect(typeof isProductionDemoEnabled()).toBe('boolean')
  })
})

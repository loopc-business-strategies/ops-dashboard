const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const { createAlloyMixService } = require('../services/erpAccounting/alloyMixService')
const {
  allocateMixJob,
  receiveMixJob,
  listMixJobs,
  serializeJob,
  autoUpdateAlloyMixAfterMetalOut,
} = require('../services/erpAccounting/alloyMixFloorBridge')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const User = require('../models/User')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')
const AlloyMixJob = require('../models/AlloyMixJob')
const ProductionStockLot = require('../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../models/ProductionStockStatusEvent')
const OperationsProductionEntry = require('../models/OperationsProductionEntry')
const FloorBatchEntry = require('../models/FloorBatchEntry')
const { ALLOY_METAL_LOSS_MAPPING_TYPE } = require('../services/erpAccounting/alloyMixService')

let mongo

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.DEFAULT_TENANT = 'mg'
  mongo = await startMongoMemoryServer()
  await mongoose.connect(mongo.getUri())
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
    ChartOfAccount.deleteMany({}),
    AccountMapping.deleteMany({}),
    Ledger.deleteMany({}),
    Transaction.deleteMany({}),
    User.deleteMany({}),
    AlloyMixJob.deleteMany({}),
    ProductionStockLot.deleteMany({}),
    ProductionStockStatusEvent.deleteMany({}),
    OperationsProductionEntry.deleteMany({}),
    FloorBatchEntry.deleteMany({}),
  ])
})

async function seedMixFixture() {
  const user = await User.create({
    name: 'alloy-floor-user',
    email: 'alloy-floor@example.com',
    password: 'password123',
    role: 'super_admin',
  })
  const invAcct = await ChartOfAccount.create({
    accountName: 'Metal Inventory',
    accountCode: '1300',
    accountType: 'Asset',
    createdBy: user._id,
  })
  const lossParty = await ChartOfAccount.create({
    accountName: 'Metal Loss',
    accountCode: 'AML',
    accountType: 'Expense',
    createdBy: user._id,
  })
  await AccountMapping.create({
    mappingType: ALLOY_METAL_LOSS_MAPPING_TYPE,
    debitAccountId: lossParty._id,
    creditAccountId: invAcct._id,
    isActive: true,
    description: 'alloy loss',
  })

  const fineGold = await InventoryItem.create({
    name: 'Gold 24K Bar',
    sku: 'AU-24K',
    category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=1',
    quantity: 100,
    unit: 'grams',
    unitCost: 50,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })
  await StockMovement.create({
    itemId: fineGold._id,
    itemName: fineGold.name,
    change: 100,
    quantityBefore: 0,
    quantityAfter: 100,
    reason: 'seed',
    actorId: user._id,
    actorName: user.name,
  })

  const silver = await InventoryItem.create({
    name: 'Fine Silver',
    sku: 'AG-FINE',
    category: 'mainStock=silver;metalType=silver;recordType=product;productPurity=0.999',
    quantity: 100,
    unit: 'grams',
    unitCost: 1,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })
  await StockMovement.create({
    itemId: silver._id,
    itemName: silver.name,
    change: 100,
    quantityBefore: 0,
    quantityAfter: 100,
    reason: 'seed',
    actorId: user._id,
    actorName: user.name,
  })

  const finished = await InventoryItem.create({
    name: '14k alloyed gold',
    sku: 'AU-14K',
    category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=0.585',
    quantity: 0,
    unit: 'grams',
    unitCost: 0,
    ledgerAccountId: invAcct._id,
    createdBy: user._id,
    updatedBy: user._id,
  })

  const service = createAlloyMixService({
    InventoryItem,
    StockMovement,
    Ledger,
    AccountMapping,
    Transaction,
    ChartOfAccount,
  })

  return { user, fineGold, silver, finished, service }
}

describe('alloy mix floor bridge', () => {
  test('post mix creates Mix Job in vault + lot + Ops vault IN', async () => {
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 80,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.mixJob?.mixCode).toMatch(/^BMG-\d{4}$/)
    expect(result.mixJob?.status).toBe('in_vault')
    expect(result.mixJob?.currentDepartment).toBe('vault_room')

    const jobs = await listMixJobs({ department: 'vault_room' })
    expect(jobs).toHaveLength(1)
    expect(serializeJob(jobs[0]).canUpdateMix).toBe(true)
    // Prefer remain grams in the finished bar (target 80; consume 85 → metal loss scaled).
    const inputs = serializeJob(jobs[0]).inputComponents
    expect(inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Gold 24K Bar', gross: 47.059 }),
      expect.objectContaining({ name: 'Fine Silver', gross: 32.941 }),
    ]))

    const lots = await ProductionStockLot.find({ inventoryItemId: finished._id })
    expect(lots).toHaveLength(1)
    expect(lots[0].status).toBe('NEW_STOCK')
    expect(Number(lots[0].grossWeight)).toBe(80)

    const ops = await OperationsProductionEntry.find({ source: 'gold_alloy' })
    expect(ops.length).toBeGreaterThanOrEqual(1)
    expect(ops.some((r) => r.departmentKey === 'vault_room' && Number(r.metalIn) === 80)).toBe(true)
  })

  test('allocate to melting then back to vault; update blocked while on floor', async () => {
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 80,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
      ],
    })

    const jobId = result.mixJob.id
    const offered = await allocateMixJob({
      user,
      mixId: jobId,
      toDepartment: 'melting',
    })
    expect(offered.currentDepartment).toBe('melting')
    expect(offered.status).toBe('pending_receive')
    expect(serializeJob(offered).canUpdateMix).toBe(false)
    expect(serializeJob(offered).pendingReceive).toBe(true)

    const { job: onFloor } = await receiveMixJob({
      user,
      mixId: jobId,
      decision: 'APPROVED',
      actorDepartment: 'melting',
    })
    expect(onFloor.currentDepartment).toBe('melting')
    expect(onFloor.status).toBe('in_department')
    expect(serializeJob(onFloor).canUpdateMix).toBe(false)

    await expect(
      service.reverseAlloyMix({ user, tenant: 'mg', reason: result.reason }),
    ).rejects.toMatchObject({ status: 400 })

    const back = await allocateMixJob({
      user,
      mixId: jobId,
      toDepartment: 'vault_room',
    })
    expect(back.currentDepartment).toBe('vault_room')
    expect(back.status).toBe('in_vault')
    expect(serializeJob(back).canUpdateMix).toBe(true)

    const reversed = await service.reverseAlloyMix({
      user,
      tenant: 'mg',
      reason: result.reason,
    })
    expect(reversed.success).toBe(true)
    // Reverse archives the live BMG code so Update can reuse it.
    expect(String(reversed.mixJobClosed || '')).toMatch(
      new RegExp(`^${result.mixJob.mixCode}__REV__`),
    )
  })

  test('partial allocate splits child job and leaves remainder', async () => {
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 80,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
      ],
    })

    const split = await allocateMixJob({
      user,
      mixId: result.mixJob.id,
      toDepartment: 'melting',
      weight: 30,
    })
    expect(split.partial).toBe(true)
    expect(Number(split.parent.targetGross)).toBe(50)
    expect(split.parent.currentDepartment).toBe('vault_room')
    expect(Number(split.child.targetGross)).toBe(30)
    expect(split.child.currentDepartment).toBe('melting')
    expect(split.child.status).toBe('pending_receive')
    expect(split.pendingReceive).toBe(true)

    const vaultJobs = await listMixJobs({ department: 'vault_room' })
    const meltJobs = await listMixJobs({ department: 'melting' })
    expect(vaultJobs.some((j) => String(j._id) === String(split.parent._id))).toBe(true)
    expect(meltJobs.some((j) => String(j._id) === String(split.child._id))).toBe(true)

    const { serializeJobs } = require('../services/erpAccounting/alloyMixFloorBridge')
    const annotated = await serializeJobs(vaultJobs)
    const parentRow = annotated.find((j) => j.id === String(split.parent._id))
    expect(parentRow.hasOpenFloorDescendants).toBe(true)
    expect(parentRow.canUpdateMix).toBe(false)
  })

  test('partial allocate blocks ERP reverse until child returns to vault', async () => {
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 80,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
      ],
    })

    const split = await allocateMixJob({
      user,
      mixId: result.mixJob.id,
      toDepartment: 'melting',
      weight: 30,
    })

    await expect(
      service.reverseAlloyMix({ user, tenant: 'mg', reason: result.reason }),
    ).rejects.toMatchObject({ status: 400 })

    await receiveMixJob({
      user,
      mixId: String(split.child._id),
      decision: 'APPROVED',
      actorDepartment: 'melting',
    })
    await allocateMixJob({
      user,
      mixId: String(split.child._id),
      toDepartment: 'vault_room',
    })

    const reversed = await service.reverseAlloyMix({
      user,
      tenant: 'mg',
      reason: result.reason,
    })
    expect(reversed.success).toBe(true)

    const openJobs = await AlloyMixJob.find({
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }).lean()
    expect(openJobs).toHaveLength(0)
  })

  test('FM approve of seeded AMX Metal In does not create a second Melting Ops Metal IN', async () => {
    const { applyApprovedEntryToWorkbook } = require('../services/mgFloor/workbookLink')
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 80,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 35, role: 'silver', label: 'silver' },
      ],
    })
    const mixCode = result.mixJob.mixCode
    await allocateMixJob({ user, mixId: result.mixJob.id, toDepartment: 'melting' })
    const { metalInEntry } = await receiveMixJob({
      user,
      mixId: result.mixJob.id,
      decision: 'APPROVED',
      actorDepartment: 'melting',
    })
    expect(metalInEntry).toBeTruthy()
    expect(metalInEntry.status).toBe('PENDING')
    // Seed one finished-alloy line (Post Mix product), not Gold/Silver inputs.
    expect(metalInEntry.lines).toEqual([
      expect.objectContaining({
        metal: expect.stringMatching(/alloyed gold/i),
        qty: 80,
        purity: 58.5,
      }),
    ])

    const meltingBefore = await OperationsProductionEntry.find({
      departmentKey: 'melting',
      alloyMixCode: mixCode,
      metalIn: { $ne: null },
    }).lean()
    expect(meltingBefore).toHaveLength(1)
    expect(meltingBefore[0].source).toBe('gold_alloy')
    expect(Number(meltingBefore[0].metalIn)).toBe(80)

    const approved = {
      ...metalInEntry,
      status: 'APPROVED',
      decidedByName: 'Floor Manager',
      decidedById: user._id,
      entryId: metalInEntry.entryId,
    }
    const linked = await applyApprovedEntryToWorkbook(approved)
    expect(linked).toBeTruthy()
    expect(linked.source).toBe('gold_alloy')
    expect(linked.floorInEntryId).toBe(metalInEntry.entryId)

    const meltingAfter = await OperationsProductionEntry.find({
      departmentKey: 'melting',
      $or: [
        { alloyMixCode: mixCode },
        { batchNumber: mixCode },
        { floorBatchKey: { $regex: mixCode } },
      ],
      metalIn: { $ne: null },
    }).lean()
    expect(meltingAfter).toHaveLength(1)
    expect(meltingAfter[0].source).toBe('gold_alloy')
    expect(Number(meltingAfter[0].metalIn)).toBe(80)
    expect(meltingAfter.every((r) => r.source !== 'mg_floor')).toBe(true)

    const totalMetalIn = meltingAfter.reduce((s, r) => s + Number(r.metalIn || 0), 0)
    expect(totalMetalIn).toBe(80)
  })

  test('FM Metal Out gross < target stamps Melting OUT and auto Updated Mix + AML', async () => {
    const { applyApprovedEntryToWorkbook } = require('../services/mgFloor/workbookLink')
    const { user, fineGold, silver, finished, service } = await seedMixFixture()
    const result = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 14,
      targetGross: 100,
      finishedProductId: String(finished._id),
      lines: [
        { itemId: String(fineGold._id), gross: 75, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 25, role: 'silver', label: 'silver' },
      ],
      reuseMixCode: 'BMG-0099',
    })
    const mixCode = result.mixJob.mixCode
    expect(mixCode).toBe('BMG-0099')

    await allocateMixJob({ user, mixId: result.mixJob.id, toDepartment: 'melting' })
    await receiveMixJob({
      user,
      mixId: result.mixJob.id,
      decision: 'APPROVED',
      actorDepartment: 'melting',
    })

    const meltingOpen = await OperationsProductionEntry.findOne({
      departmentKey: 'melting',
      alloyMixCode: mixCode,
      metalIn: { $ne: null },
      metalOut: null,
    })
    expect(meltingOpen).toBeTruthy()
    expect(Number(meltingOpen.metalIn)).toBe(100)

    const floorOut = {
      direction: 'OUT',
      status: 'APPROVED',
      department: 'melting',
      batchLabel: mixCode,
      entryId: 'floor-out-bmg-0099',
      entryDate: '2026-11-21',
      decidedByName: 'Floor Manager',
      decidedById: user._id,
      decidedAt: new Date('2026-11-21T12:00:00.000Z'),
      lines: [{ metal: '14k alloyed gold', qty: 99.3, purity: 58.5 }],
    }
    const linked = await applyApprovedEntryToWorkbook(floorOut)
    expect(Number(linked.metalOut)).toBe(99.3)
    expect(Number(linked.metalLoss)).toBeCloseTo(0.7, 5)
    expect(Number(linked.purityOut)).toBe(58.5)

    await allocateMixJob({
      user,
      mixId: result.mixJob.id,
      toDepartment: 'vault_room',
    })
    const meltingAfterReturn = await OperationsProductionEntry.findById(linked._id).lean()
    // Floor OUT preserved (not overwritten by full allocate targetGross).
    expect(Number(meltingAfterReturn.metalOut)).toBe(99.3)
    expect(Number(meltingAfterReturn.metalLoss)).toBeCloseTo(0.7, 5)

    const updated = await autoUpdateAlloyMixAfterMetalOut({
      user,
      batchLabel: mixCode,
      outGross: 99.3,
      tenant: 'mg',
    })
    expect(updated?.success).toBe(true)
    expect(Number(updated.targetGross)).toBe(99.3)
    expect(Number(updated.metalLossGross)).toBeCloseTo(0.7, 5)
    expect(updated.reason).toMatch(/updated/i)
    expect(updated.mixJob?.mixCode).toBe(mixCode)

    const liveJob = await AlloyMixJob.findOne({ mixCode, isDeleted: { $ne: true }, status: 'in_vault' }).lean()
    expect(liveJob).toBeTruthy()
    expect(Number(liveJob.targetGross)).toBe(99.3)

    // Post Mix vault + one back-from-Melting vault (promoted) — no extra Updated Mix row.
    const vaultRows = await OperationsProductionEntry.find({
      source: 'gold_alloy',
      departmentKey: 'vault_room',
      alloyMixCode: mixCode,
    }).sort({ batchStartedAt: 1 }).lean()
    expect(vaultRows).toHaveLength(2)
    const openVault = vaultRows.find((r) => r.metalOut == null)
    expect(openVault).toBeTruthy()
    expect(Number(openVault.metalIn)).toBeCloseTo(99.3, 5)
    expect(String(openVault.transferFromDepartment || '').toLowerCase()).toBe('melting')
    expect(vaultRows.filter((r) => String(r.transferFromDepartment || '').toLowerCase() === 'update_mix')).toHaveLength(0)

    // Original vault take kept for inventory re-consume on later Updates.
    expect(liveJob.inputComponents.every((c) => Number(c.consumeGross) > 0)).toBe(true)
    const amlAfterFirst = await Transaction.find({
      isDeleted: { $ne: true },
      type: 'metal_payment',
      'voucherMeta.vocNo': { $regex: /^AML-/i },
    }).lean()
    const firstAmlGrams = amlAfterFirst.reduce(
      (s, tx) => s + (tx.voucherMeta?.lineItems || []).reduce((a, li) => a + Number(li.pureWeight || 0), 0),
      0,
    )
    expect(firstAmlGrams).toBeCloseTo(0.7, 5)
    const firstAmlCount = amlAfterFirst.length

    // Second floor OUT (e.g. Rolling): keep Melting AML + add this-step ~0.1 → two bookings.
    const second = await autoUpdateAlloyMixAfterMetalOut({
      user,
      batchLabel: mixCode,
      outGross: 99.2,
      tenant: 'mg',
    })
    expect(second?.success).toBe(true)

    const amlLive = await Transaction.find({
      isDeleted: { $ne: true },
      type: 'metal_payment',
      'voucherMeta.vocNo': { $regex: /^AML-/i },
    }).lean()
    const liveAmlGrams = amlLive.reduce(
      (s, tx) => s + (tx.voucherMeta?.lineItems || []).reduce((a, li) => a + Number(li.pureWeight || 0), 0),
      0,
    )
    expect(amlLive.length).toBeGreaterThan(firstAmlCount)
    expect(liveAmlGrams).toBeCloseTo(0.8, 5)
  })
})

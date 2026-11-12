const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const {
  createAlloyMixService,
  ALLOY_METAL_LOSS_MAPPING_TYPE,
} = require('../services/erpAccounting/alloyMixService')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const User = require('../models/User')
const ChartOfAccount = require('../models/ChartOfAccount')
const AccountMapping = require('../models/AccountMapping')
const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')

let mongo

beforeAll(async () => {
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
  ])
})

describe('alloy mix inventory', () => {
  test('consumes inputs and receives finished 22K alloy with rolled book value', async () => {
    const user = await User.create({
      name: 'alloy-mix-user',
      email: 'alloy-mix@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const invAcct = await ChartOfAccount.create({
      accountName: 'Metal Inventory',
      accountCode: '1300',
      accountType: 'Asset',
      createdBy: user._id,
    })

    const fineGold = await InventoryItem.create({
      name: 'Gold 24K Bar',
      sku: 'AU-24K',
      category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=1',
      quantity: 200,
      unit: 'grams',
      unitCost: 100,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: fineGold._id,
      itemName: fineGold.name,
      change: 200,
      quantityBefore: 0,
      quantityAfter: 200,
      reason: 'seed',
      actorId: user._id,
      actorName: user.name,
    })

    const silver = await InventoryItem.create({
      name: 'Silver',
      sku: 'AG-1',
      category: 'mainStock=silver;metalType=silver;recordType=product;productPurity=1',
      quantity: 50,
      unit: 'grams',
      unitCost: 2,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: silver._id,
      itemName: silver.name,
      change: 50,
      quantityBefore: 0,
      quantityAfter: 50,
      reason: 'seed',
      actorId: user._id,
      actorName: user.name,
    })

    const finished = await InventoryItem.create({
      name: '22K Alloyed Gold',
      sku: 'AU-22K-ALLOY',
      category: 'mainStock=alloy;metalType=alloy;recordType=product;productPurity=0.916',
      quantity: 0,
      unit: 'grams',
      unitCost: 0,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })

    const svc = createAlloyMixService({
      InventoryItem,
      StockMovement,
      Ledger: null,
      assertAccountingPeriodOpen: async () => {},
    })

    const result = await svc.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 22,
      targetGross: 100,
      finishedProductId: finished._id,
      lines: [
        { itemId: fineGold._id, gross: 91.6, role: 'gold', label: 'gold' },
        { itemId: silver._id, gross: 8.4, role: 'alloy', label: 'silver' },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.bookValue).toBeCloseTo(91.6 * 100 + 8.4 * 2, 1)
    expect(result.finishedProduct.quantity).toBeCloseTo(100, 3)

    const afterGold = await InventoryItem.findById(fineGold._id)
    const afterSilver = await InventoryItem.findById(silver._id)
    const afterFinished = await InventoryItem.findById(finished._id)
    expect(Number(afterGold.quantity)).toBeCloseTo(108.4, 3)
    expect(Number(afterSilver.quantity)).toBeCloseTo(41.6, 3)
    expect(Number(afterFinished.quantity)).toBeCloseTo(100, 3)
    expect(Number(afterFinished.unitCost)).toBeCloseTo(result.bookValue / 100, 1)

    const outMoves = await StockMovement.find({ itemId: finished._id, change: { $gt: 0 }, isDeleted: { $ne: true } })
    expect(outMoves).toHaveLength(1)
    expect(Number(outMoves[0].valueDelta)).toBeCloseTo(result.bookValue, 1)

    const reversed = await svc.reverseAlloyMix({
      user,
      tenant: 'mg',
      reason: result.reason,
    })
    expect(reversed.success).toBe(true)
    expect(reversed.reversedMovements).toBeGreaterThanOrEqual(3)

    const goldRestored = await InventoryItem.findById(fineGold._id)
    const silverRestored = await InventoryItem.findById(silver._id)
    const finishedRestored = await InventoryItem.findById(finished._id)
    expect(Number(goldRestored.quantity)).toBeCloseTo(200, 3)
    expect(Number(silverRestored.quantity)).toBeCloseTo(50, 3)
    expect(Number(finishedRestored.quantity)).toBeCloseTo(0, 3)

    const activeReceive = await StockMovement.find({
      itemId: finished._id,
      change: { $gt: 0 },
      isDeleted: { $ne: true },
    })
    expect(activeReceive).toHaveLength(0)
  })

  test('reverse rebuilds later movement before/after so history matches on-hand', async () => {
    const user = await User.create({
      name: 'alloy-rebuild-user',
      email: 'alloy-rebuild@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const fineGold = await InventoryItem.create({
      name: 'Gold 24K Bar',
      category: 'mainStock=gold;recordType=product;productPurity=1',
      quantity: 100,
      unit: 'grams',
      unitCost: 100,
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
    const finished = await InventoryItem.create({
      name: '18K Alloyed Gold',
      category: 'mainStock=alloy;recordType=product;productPurity=0.75',
      quantity: 0,
      unit: 'grams',
      unitCost: 0,
      createdBy: user._id,
      updatedBy: user._id,
    })

    const svc = createAlloyMixService({
      InventoryItem,
      StockMovement,
      Ledger: null,
      assertAccountingPeriodOpen: async () => {},
    })

    const posted = await svc.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 18,
      targetGross: 10,
      finishedProductId: finished._id,
      lines: [{ itemId: fineGold._id, gross: 10, role: 'gold', label: 'gold' }],
    })

    // Stock-in after the mix (before reverse) — before/after reflect mix still applied.
    await StockMovement.create({
      itemId: fineGold._id,
      itemName: fineGold.name,
      change: 20,
      quantityBefore: 90,
      quantityAfter: 110,
      reason: 'Stock IN (purchase)',
      actorId: user._id,
      actorName: user.name,
    })
    await InventoryItem.updateOne({ _id: fineGold._id }, { $set: { quantity: 110 } })

    await svc.reverseAlloyMix({
      user,
      tenant: 'mg',
      reason: posted.reason,
    })

    const gold = await InventoryItem.findById(fineGold._id)
    expect(Number(gold.quantity)).toBeCloseTo(120, 3)

    const laterIn = await StockMovement.findOne({
      itemId: fineGold._id,
      reason: 'Stock IN (purchase)',
      isDeleted: { $ne: true },
    })
    expect(Number(laterIn.quantityBefore)).toBeCloseTo(100, 3)
    expect(Number(laterIn.quantityAfter)).toBeCloseTo(120, 3)
  })

  test('rejects non-MG tenant and insufficient stock', async () => {
    const user = await User.create({
      name: 'alloy-mix-deny',
      email: 'alloy-deny@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const finished = await InventoryItem.create({
      name: '22K Alloyed Gold',
      category: 'mainStock=alloy;recordType=product;productPurity=0.916',
      quantity: 0,
      unit: 'grams',
      createdBy: user._id,
      updatedBy: user._id,
    })
    const fineGold = await InventoryItem.create({
      name: 'Gold 24K Bar',
      category: 'mainStock=gold;recordType=product;productPurity=1',
      quantity: 10,
      unit: 'grams',
      unitCost: 100,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: fineGold._id,
      itemName: fineGold.name,
      change: 10,
      quantityBefore: 0,
      quantityAfter: 10,
      reason: 'seed',
      actorId: user._id,
      actorName: user.name,
    })

    const svc = createAlloyMixService({
      InventoryItem,
      StockMovement,
      Ledger: null,
    })

    await expect(svc.postAlloyMix({
      user,
      tenant: 'vb',
      karat: 22,
      targetGross: 100,
      finishedProductId: finished._id,
      lines: [{ itemId: fineGold._id, gross: 100, role: 'gold' }],
    })).rejects.toMatchObject({ status: 403 })

    await expect(svc.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 22,
      targetGross: 100,
      finishedProductId: finished._id,
      lines: [{ itemId: fineGold._id, gross: 100, role: 'gold' }],
    })).rejects.toMatchObject({ status: 400 })
  })

  test('posts oxidation metal loss when input gross exceeds finished', async () => {
    const user = await User.create({
      name: 'alloy-loss-user',
      email: 'alloy-loss@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const invAcct = await ChartOfAccount.create({
      accountName: 'Metal Inventory',
      accountCode: '1300',
      accountType: 'Asset',
      createdBy: user._id,
    })
    const lossAcct = await ChartOfAccount.create({
      accountName: 'Metal Loss',
      accountCode: '5500',
      accountType: 'Expense',
      createdBy: user._id,
    })
    await AccountMapping.create({
      mappingType: ALLOY_METAL_LOSS_MAPPING_TYPE,
      debitAccountId: lossAcct._id,
      creditAccountId: invAcct._id,
      description: 'Alloy oxidation loss',
      isActive: true,
    })

    const fineGold = await InventoryItem.create({
      name: 'Gold 24K Bar',
      category: 'mainStock=gold;recordType=product;productPurity=1',
      quantity: 200,
      unit: 'grams',
      unitCost: 100,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: fineGold._id,
      itemName: fineGold.name,
      change: 200,
      quantityBefore: 0,
      quantityAfter: 200,
      reason: 'seed',
      actorId: user._id,
      actorName: user.name,
    })
    const finished = await InventoryItem.create({
      name: '18K Alloyed Gold',
      category: 'mainStock=alloy;recordType=product;productPurity=0.75',
      quantity: 0,
      unit: 'grams',
      unitCost: 0,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })

    const svc = createAlloyMixService({
      InventoryItem,
      StockMovement,
      Ledger,
      AccountMapping,
      Transaction,
      ChartOfAccount,
      assertAccountingPeriodOpen: async () => {},
    })

    // Consume 100 g gold into 96 g finished → 4 g oxidation loss.
    const result = await svc.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 18,
      targetGross: 96,
      finishedProductId: finished._id,
      lines: [{
        itemId: fineGold._id,
        gross: 100,
        remainGross: 96,
        role: 'gold',
        label: 'gold',
      }],
      description: 'Gold alloy mix (18K 96 g · updated)',
    })

    expect(result.metalLossGross).toBeCloseTo(4, 3)
    expect(result.metalLossBookValue).toBeCloseTo(400, 1)
    expect(result.bookValue).toBeCloseTo(9600, 1)
    expect(Number((await InventoryItem.findById(fineGold._id)).quantity)).toBeCloseTo(100, 3)
    expect(Number((await InventoryItem.findById(finished._id)).quantity)).toBeCloseTo(96, 3)

    const lossLedgers = await Ledger.find({
      isDeleted: { $ne: true },
      debitAccountId: lossAcct._id,
    })
    expect(lossLedgers.length).toBeGreaterThanOrEqual(1)
    const lossSum = lossLedgers.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    expect(lossSum).toBeCloseTo(400, 1)

    const positionTxs = await Transaction.find({
      isDeleted: { $ne: true },
      type: 'metal_payment',
      'voucherMeta.partyAccountId': lossAcct._id,
    }).lean()
    expect(positionTxs).toHaveLength(1)
    expect(positionTxs[0].status).toBe('posted')
    expect(Number(positionTxs[0].amount)).toBe(0)
    expect(positionTxs[0].voucherMeta?.fixingType).toBe('non-fixing')
    expect(positionTxs[0].voucherMeta?.lineItems).toHaveLength(1)
    expect(Number(positionTxs[0].voucherMeta?.lineItems?.[0]?.pureWeight)).toBeCloseTo(4, 3)
    expect(String(positionTxs[0].voucherMeta?.lineItems?.[0]?.stockCode || '')).toBe('XAU')
  })
})

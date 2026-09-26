const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const { createVoucherInventoryImpactService } = require('../services/erpAccounting/voucherInventoryImpactService')
const { reverseMetalVoucherStockForVoid } = require('../utils/metalVoucherStockReversal')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const ProductionStockLot = require('../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../models/ProductionStockStatusEvent')
const User = require('../models/User')
const ChartOfAccount = require('../models/ChartOfAccount')

let mongo

const toQty = (n) => Math.round(Number(n || 0) * 1000) / 1000
const toMoney = (n) => Math.round(Number(n || 0) * 100) / 100

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
    ProductionStockLot.deleteMany({}),
    ProductionStockStatusEvent.deleteMany({}),
    ChartOfAccount.deleteMany({}),
    User.deleteMany({}),
  ])
})

describe('metal_transfer book value + vault lots', () => {
  test('moves From unitCost value onto To and creates To lot; void restores value and lots', async () => {
    const user = await User.create({
      name: 'mtr-value-user',
      email: 'mtr-value@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const invAcct = await ChartOfAccount.create({
      accountName: 'Metal Inventory',
      accountCode: '1300',
      accountType: 'Asset',
      createdBy: user._id,
    })

    const fromItem = await InventoryItem.create({
      name: '14k alloyed Gold',
      sku: 'AU-14K',
      category: 'recordType=product;purity=0.583',
      quantity: 1000,
      unit: 'grams',
      unitCost: 80.84,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })
    const toItem = await InventoryItem.create({
      name: 'Pure Gold',
      sku: 'AU-PURE',
      category: 'recordType=product;purity=1',
      quantity: 0,
      unit: 'grams',
      unitCost: 0,
      ledgerAccountId: invAcct._id,
      createdBy: user._id,
      updatedBy: user._id,
    })

    // Seed a From vault lot so OUT can consume
    await ProductionStockLot.create({
      stockCode: 'SEED-14K-001',
      purchaseRef: 'seed',
      product: fromItem.name,
      quantity: 1000,
      grossWeight: 1000,
      netWeight: 583,
      metalType: 'Gold',
      purity: '0.583',
      status: 'NEW_STOCK',
      inventoryItemId: fromItem._id,
      createdById: user._id,
      createdByName: user.name,
      version: 0,
    })

    const svc = createVoucherInventoryImpactService({
      ensureAccountByCode: async () => invAcct,
      InventoryItem,
      StockMovement,
      Ledger: { create: async () => [] },
      toQty,
      toMoney,
      BASE_CURRENCY_CODE: 'USD',
    })

    const tx = {
      _id: new mongoose.Types.ObjectId(),
      type: 'metal_transfer',
      date: new Date('2026-09-01'),
      currency: 'USD',
      voucherMeta: {
        vocNo: 'MTr/2026/value-1',
        lineItems: [
          {
            transferSide: 'from',
            stockCode: 'AU-14K',
            productType: fromItem.name,
            itemId: fromItem._id.toString(),
            grossWeight: 10,
            purity: 0.583,
            pureWeight: 5.83,
          },
          {
            transferSide: 'to',
            stockCode: 'AU-PURE',
            productType: toItem.name,
            itemId: toItem._id.toString(),
            grossWeight: 5.83,
            purity: 1,
            pureWeight: 5.83,
          },
        ],
      },
    }

    const prepared = await svc.prepareVoucherInventoryImpact({ user, tx })
    expect(prepared.inventoryPlans).toHaveLength(2)
    const fromPlan = prepared.inventoryPlans.find((p) => p.transferSide === 'from')
    const toPlan = prepared.inventoryPlans.find((p) => p.transferSide === 'to')
    expect(Number(fromPlan.costAmount)).toBeCloseTo(808.4, 2)
    expect(Number(toPlan.incomingValue)).toBeCloseTo(808.4, 2)

    await svc.applyVoucherInventoryImpact({ user, tx, preparedImpact: prepared })

    const afterFrom = await InventoryItem.findById(fromItem._id)
    const afterTo = await InventoryItem.findById(toItem._id)
    expect(Number(afterFrom.quantity)).toBeCloseTo(990, 3)
    expect(Number(afterFrom.unitCost)).toBeCloseTo(80.84, 2)
    expect(Number(afterTo.quantity)).toBeCloseTo(5.83, 3)
    expect(Number(afterTo.unitCost)).toBeCloseTo(138.66, 1) // 808.4 / 5.83
    expect(Number(afterFrom.quantity) * Number(afterFrom.unitCost)
      + Number(afterTo.quantity) * Number(afterTo.unitCost)).toBeCloseTo(1000 * 80.84, 0)

    const toInMove = await StockMovement.findOne({ itemId: toItem._id, change: { $gt: 0 } })
    expect(Number(toInMove.valueDelta)).toBeCloseTo(808.4, 2)

    const toLots = await ProductionStockLot.find({
      inventoryItemId: toItem._id,
      status: 'NEW_STOCK',
    })
    expect(toLots).toHaveLength(1)
    expect(String(toLots[0].stockCode)).toMatch(/^MTR-/)

    await reverseMetalVoucherStockForVoid({
      tx,
      user,
      StockMovement,
      InventoryItem,
      toQty,
      deleteReason: 'unit test void',
    })

    const voidFrom = await InventoryItem.findById(fromItem._id)
    const voidTo = await InventoryItem.findById(toItem._id)
    expect(Number(voidFrom.quantity)).toBeCloseTo(1000, 3)
    expect(Number(voidTo.quantity)).toBeCloseTo(0, 3)
    expect(Number(voidTo.unitCost)).toBe(0)

    const cancelledTo = await ProductionStockLot.find({
      inventoryItemId: toItem._id,
      status: 'CANCELLED',
    })
    expect(cancelledTo.length).toBeGreaterThanOrEqual(1)

    const restoredFromLots = await ProductionStockLot.find({
      inventoryItemId: fromItem._id,
      status: 'NEW_STOCK',
      remarks: /Restored by metal transfer void/i,
    })
    expect(restoredFromLots).toHaveLength(1)
    expect(Number(restoredFromLots[0].grossWeight)).toBeCloseTo(10, 3)
  })
})

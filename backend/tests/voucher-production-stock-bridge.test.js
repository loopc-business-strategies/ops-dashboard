const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const {
  createLotsFromPurchasePlans,
  cancelLotsForVoidedPurchase,
  assertAndConsumeVaultLotsForStockOut,
  idempotencyKeyForLine,
} = require('../services/erpAccounting/voucherProductionStockBridge')
const ProductionStockLot = require('../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../models/ProductionStockStatusEvent')
const InventoryItem = require('../models/InventoryItem')
const User = require('../models/User')

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
    ProductionStockLot.deleteMany({}),
    ProductionStockStatusEvent.deleteMany({}),
    InventoryItem.deleteMany({}),
    User.deleteMany({}),
  ])
})

describe('voucherProductionStockBridge', () => {
  test('creates NEW_STOCK lot from purchase plans and is idempotent', async () => {
    const user = await User.create({
      name: 'bridge-user',
      email: 'bridge@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'Gold bar 999',
      sku: 'AU-999',
      category: 'gold',
      quantity: 0,
      unit: 'grams',
      createdBy: user._id,
      updatedBy: user._id,
    })
    const tx = {
      _id: new mongoose.Types.ObjectId(),
      type: 'purchase',
      date: new Date('2026-03-01'),
      voucherMeta: {
        vocNo: 'Pur/2026/bridge-1',
        partyName: 'Metal Supplier',
        lineItems: [{ grossWeight: 100, pureWeight: 99.5, purity: 995 }],
      },
    }
    const plans = [{
      item,
      quantity: 100,
      line: tx.voucherMeta.lineItems[0],
    }]

    const first = await createLotsFromPurchasePlans({ user, tx, plans })
    expect(first.created).toHaveLength(1)
    expect(first.reused).toHaveLength(0)
    expect(first.created[0].status).toBe('NEW_STOCK')
    expect(first.created[0].inventoryItemId.toString()).toBe(item._id.toString())
    expect(first.created[0].purchaseRef).toBe('Pur/2026/bridge-1')
    expect(first.created[0].idempotencyKey).toBe(idempotencyKeyForLine(tx._id, 0))
    expect(Number(first.created[0].netWeight)).toBe(99.5)

    const second = await createLotsFromPurchasePlans({ user, tx, plans })
    expect(second.created).toHaveLength(0)
    expect(second.reused).toHaveLength(1)

    const count = await ProductionStockLot.countDocuments({})
    expect(count).toBe(1)
  })

  test('void cancels unused NEW_STOCK lot without delete', async () => {
    const user = await User.create({
      name: 'bridge-void-user',
      email: 'bridge-void@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'Silver grain',
      sku: 'AG-999',
      category: 'silver',
      quantity: 50,
      unit: 'grams',
      createdBy: user._id,
      updatedBy: user._id,
    })
    const tx = {
      _id: new mongoose.Types.ObjectId(),
      type: 'purchase',
      date: new Date(),
      voucherMeta: { vocNo: 'Pur/2026/void-1', lineItems: [{ grossWeight: 50 }] },
    }
    const plans = [{ item, quantity: 50, line: { grossWeight: 50 } }]
    const { created } = await createLotsFromPurchasePlans({ user, tx, plans })
    expect(created).toHaveLength(1)

    const result = await cancelLotsForVoidedPurchase({
      user,
      tx,
      deleteReason: 'unit test void',
    })
    expect(result.cancelled).toHaveLength(1)

    const lot = await ProductionStockLot.findById(created[0]._id)
    expect(lot).toBeTruthy()
    expect(lot.status).toBe('CANCELLED')
    expect(String(lot.remarks)).toMatch(/Reversed by voucher void/)
  })

  test('ignores non stock-in voucher types', async () => {
    const user = { _id: new mongoose.Types.ObjectId(), name: 'x' }
    const result = await createLotsFromPurchasePlans({
      user,
      tx: { _id: new mongoose.Types.ObjectId(), type: 'sale' },
      plans: [{ item: { _id: new mongoose.Types.ObjectId(), name: 'x' }, quantity: 1, line: {} }],
    })
    expect(result.created).toHaveLength(0)
    expect(await ProductionStockLot.countDocuments({})).toBe(0)
  })

  test('rejects metal OUT when vault available is insufficient', async () => {
    const user = await User.create({
      name: 'out-user',
      email: 'out@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'Gold grain',
      sku: 'AU-OUT',
      category: 'gold',
      quantity: 300,
      unit: 'grams',
      createdBy: user._id,
      updatedBy: user._id,
    })
    await ProductionStockLot.create({
      stockCode: 'STK-OUT-1',
      product: 'Gold grain',
      status: 'NEW_STOCK',
      inventoryItemId: item._id,
      netWeight: 300,
      grossWeight: 300,
      metalType: 'Gold',
      createdById: user._id,
      createdByName: user.name,
    })

    await expect(
      assertAndConsumeVaultLotsForStockOut({
        user,
        item,
        quantity: 500,
        reason: 'unit insufficient',
      }),
    ).rejects.toThrow(/Insufficient vault stock\. Available: 300 g, requested: 500 g\./)
  })

  test('consumes vault lots on metal OUT without exceeding available', async () => {
    const user = await User.create({
      name: 'consume-user',
      email: 'consume@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'Gold grain 2',
      sku: 'AU-OUT-2',
      category: 'gold',
      quantity: 500,
      unit: 'grams',
      createdBy: user._id,
      updatedBy: user._id,
    })
    const lot = await ProductionStockLot.create({
      stockCode: 'STK-OUT-2',
      product: 'Gold grain 2',
      status: 'AVAILABLE',
      inventoryItemId: item._id,
      netWeight: 500,
      grossWeight: 500,
      metalType: 'Gold',
      createdById: user._id,
      createdByName: user.name,
    })

    const result = await assertAndConsumeVaultLotsForStockOut({
      user,
      item,
      quantity: 200,
      reason: 'unit consume',
    })
    expect(result.consumed).toHaveLength(1)
    expect(Number(result.consumed[0].weight)).toBe(200)

    const after = await ProductionStockLot.findById(lot._id)
    expect(Number(after.netWeight)).toBe(300)
    expect(after.status).toBe('AVAILABLE')
  })
})

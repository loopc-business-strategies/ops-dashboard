const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const { reverseMetalVoucherStockForVoid } = require('../utils/metalVoucherStockReversal')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const ProductionStockLot = require('../models/ProductionStockLot')
const User = require('../models/User')

let mongo

const toQty = (value) => Math.round(Number(value || 0) * 1000) / 1000

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
    User.deleteMany({}),
  ])
})

describe('reverseMetalVoucherStockForVoid', () => {
  test('restores pre-voucher on-hand qty when voiding the only stock movement', async () => {
    const user = await User.create({
      name: 'void-stock-user',
      email: 'void-stock@example.com',
      password: 'password123',
      role: 'super_admin',
    })

    const item = await InventoryItem.create({
      name: 'silver void unit',
      sku: 'SILV-UNIT',
      category: 'recordType=product',
      quantity: 100,
      unit: 'grams',
      unitCost: 10,
      createdBy: user._id,
      updatedBy: user._id,
    })

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: 2,
      quantityBefore: 100,
      quantityAfter: 102,
      reason: 'Voucher purchase (FIXED) #Pur/2026/unit-test',
      actorId: user._id,
      actorName: user.name,
    })

    item.quantity = 102
    await item.save()

    const tx = {
      type: 'purchase',
      voucherMeta: { vocNo: 'Pur/2026/unit-test' },
    }

    await reverseMetalVoucherStockForVoid({
      tx,
      user,
      StockMovement,
      InventoryItem,
      toQty,
      deleteReason: 'unit test void',
    })

    const after = await InventoryItem.findById(item._id)
    expect(Number(after.quantity)).toBe(100)

    const activeMoves = await StockMovement.find({ itemId: item._id, isDeleted: { $ne: true } })
    expect(activeMoves).toHaveLength(0)
  })

  test('voiding a zero-cost unfixed purchase restores the average cost it diluted', async () => {
    const user = await User.create({
      name: 'void-unfixed-user',
      email: 'void-unfixed@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'gold bar void unfixed',
      sku: 'GOLD-UF-VOID',
      category: 'recordType=product;mainStock=gold',
      quantity: 400,
      unit: 'grams',
      unitCost: 65.89,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: 200,
      quantityBefore: 200,
      quantityAfter: 400,
      valueDelta: 0,
      carriesValue: true,
      reason: 'Voucher purchase (UNFIXED) #Pur/2026/unfixed-void',
      actorId: user._id,
      actorName: user.name,
    })

    await reverseMetalVoucherStockForVoid({
      tx: { type: 'purchase', voucherMeta: { vocNo: 'Pur/2026/unfixed-void' } },
      user,
      StockMovement,
      InventoryItem,
      toQty,
      deleteReason: 'unit test void',
    })

    const after = await InventoryItem.findById(item._id)
    expect(Number(after.quantity)).toBe(200)
    expect(Number(after.unitCost)).toBe(131.78)
  })

  test('voiding a fixed purchase removes the voucher amount from average cost', async () => {
    const user = await User.create({
      name: 'void-fixed-user',
      email: 'void-fixed@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'gold bar fixed void',
      sku: 'GOLD-FX-VOID',
      category: 'recordType=product;mainStock=gold',
      quantity: 200,
      unit: 'grams',
      unitCost: 15,
      createdBy: user._id,
      updatedBy: user._id,
    })
    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: 100,
      quantityBefore: 100,
      quantityAfter: 200,
      valueDelta: 0,
      carriesValue: false,
      reason: 'Voucher purchase (FIXED) #Pur/2026/fixed-void',
      actorId: user._id,
      actorName: user.name,
    })

    await reverseMetalVoucherStockForVoid({
      tx: {
        type: 'purchase',
        voucherMeta: {
          vocNo: 'Pur/2026/fixed-void',
          lineItems: [{ inventoryItemId: item._id, amountLC: 1000, grossWeight: 100 }],
        },
      },
      user,
      StockMovement,
      InventoryItem,
      toQty,
      deleteReason: 'unit test void',
    })

    const after = await InventoryItem.findById(item._id)
    expect(Number(after.quantity)).toBe(100)
    expect(Number(after.unitCost)).toBe(20)
  })

  test('voiding a sale restores inventory and recreates a vault lot for OUT qty', async () => {
    const user = await User.create({
      name: 'void-sale-vault-user',
      email: 'void-sale-vault@example.com',
      password: 'password123',
      role: 'super_admin',
    })
    const item = await InventoryItem.create({
      name: 'Gold Bar',
      sku: 'GOLD-SALE-VOID',
      category: 'recordType=product;mainStock=gold',
      quantity: 900,
      unit: 'grams',
      unitCost: 100,
      createdBy: user._id,
      updatedBy: user._id,
    })
    const originalLot = await ProductionStockLot.create({
      stockCode: 'PUR-SALE-VOID-00',
      product: 'Gold Bar',
      status: 'AVAILABLE',
      inventoryItemId: item._id,
      grossWeight: 900,
      netWeight: 900,
      quantity: 900,
      metalType: 'Gold',
      remarks: 'Customer metal OUT Sal/2026/sale-void (−100g)',
      createdById: user._id,
      createdByName: user.name,
    })
    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      change: -100,
      quantityBefore: 1000,
      quantityAfter: 900,
      reason: 'Voucher sale (FIXED) #Sal/2026/sale-void',
      actorId: user._id,
      actorName: user.name,
    })

    const tx = {
      _id: new mongoose.Types.ObjectId(),
      type: 'sale',
      date: new Date('2026-10-20'),
      voucherMeta: {
        vocNo: 'Sal/2026/sale-void',
        lineItems: [{ inventoryItemId: item._id, stockCode: 'GOLD', grossWeight: 100, pureWeight: 100 }],
      },
    }

    await reverseMetalVoucherStockForVoid({
      tx,
      user,
      StockMovement,
      InventoryItem,
      toQty,
      deleteReason: 'Posted transaction edited — inventory reversal',
    })

    const afterItem = await InventoryItem.findById(item._id)
    expect(Number(afterItem.quantity)).toBe(1000)

    const restoreLot = await ProductionStockLot.findOne({
      idempotencyKey: `voucher-stock-restore-out:${String(tx._id)}:${String(item._id)}`,
    })
    expect(restoreLot).toBeTruthy()
    expect(restoreLot.status).toBe('NEW_STOCK')
    expect(Number(restoreLot.grossWeight)).toBe(100)
    expect(Number(originalLot.grossWeight)).toBe(900)
  })
})

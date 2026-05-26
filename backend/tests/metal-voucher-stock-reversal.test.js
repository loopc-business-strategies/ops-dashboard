const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { reverseMetalVoucherStockForVoid } = require('../utils/metalVoucherStockReversal')
const InventoryItem = require('../models/InventoryItem')
const StockMovement = require('../models/StockMovement')
const User = require('../models/User')

let mongo

const toQty = (value) => Math.round(Number(value || 0) * 1000) / 1000

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  await mongoose.connect(mongo.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  if (mongo) await mongo.stop()
})

afterEach(async () => {
  await Promise.all([
    InventoryItem.deleteMany({}),
    StockMovement.deleteMany({}),
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
})

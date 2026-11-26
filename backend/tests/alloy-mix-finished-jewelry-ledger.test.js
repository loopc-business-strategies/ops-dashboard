const mongoose = require('mongoose')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')
const {
  createAlloyMixService,
} = require('../services/erpAccounting/alloyMixService')
const {
  transferVaultMixToFinishedJewelry,
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

async function seedWipMixFixture() {
  const user = await User.create({
    name: 'fj-ledger-user',
    email: 'fj-ledger@example.com',
    password: 'password123',
    role: 'super_admin',
  })
  const stockInHand = await ChartOfAccount.create({
    accountName: 'Stock in Hand',
    accountCode: '1200',
    accountType: 'Asset',
    createdBy: user._id,
  })
  const wipAcct = await ChartOfAccount.create({
    accountName: 'Inventory - Work in Progress',
    accountCode: '1205',
    accountType: 'Asset',
    parentAccountId: stockInHand._id,
    createdBy: user._id,
  })
  const metalAcct = await ChartOfAccount.create({
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
    creditAccountId: metalAcct._id,
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
    ledgerAccountId: metalAcct._id,
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
    ledgerAccountId: metalAcct._id,
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

  // Alloy WIP item: no ledger account yet (mirrors MG "22K Gold Alloy Mix").
  const wipItem = await InventoryItem.create({
    name: '22K Gold Alloy Mix',
    sku: 'WIP-22K',
    type: 'wip',
    category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=0.916',
    quantity: 0,
    unit: 'g',
    unitCost: 0,
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

  return { user, fineGold, silver, wipItem, service, wipAcct, stockInHand }
}

describe('Vault → Finished Jewelry ledger linking', () => {
  test('new product gets Inventory - Finished Jewelry (1215) and WIP source links to 1205 with a balanced JV', async () => {
    const { user, fineGold, silver, wipItem, service, wipAcct } = await seedWipMixFixture()

    const posted = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 22,
      targetGross: 80,
      finishedProductId: String(wipItem._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 30, role: 'silver', label: 'silver' },
      ],
    })
    expect(posted.success).toBe(true)
    const mixId = posted.mixJob?.id || posted.mixJob?._id

    // Give the WIP item a cost so the transfer carries value.
    await InventoryItem.updateOne({ _id: wipItem._id }, { $set: { unitCost: 50 } })

    const result = await transferVaultMixToFinishedJewelry({
      user,
      mixId,
      newProduct: { name: 'Gold Chain Test', category: 'Finished Jewelry' },
      gross: 80,
      pcs: 4,
      note: 'ledger test',
    })
    expect(result.success !== false).toBe(true)
    expect(result.accountingWarning).toBe('')
    expect(result.ledgerPosted).toBe(true)

    const fjAcct = await ChartOfAccount.findOne({ accountCode: '1215' }).lean()
    expect(fjAcct).toBeTruthy()
    expect(fjAcct.accountName).toBe('Inventory - Finished Jewelry')
    expect(fjAcct.accountType).toBe('Asset')

    const newProduct = await InventoryItem.findOne({ name: 'Gold Chain Test' }).lean()
    expect(newProduct).toBeTruthy()
    expect(String(newProduct.ledgerAccountId)).toBe(String(fjAcct._id))

    const wipAfter = await InventoryItem.findById(wipItem._id).lean()
    expect(String(wipAfter.ledgerAccountId)).toBe(String(wipAcct._id))

    // Ledger is one row per double entry: Dr Finished Jewelry (1215), Cr WIP (1205).
    const entries = await Ledger.find({ referenceType: 'inventory' }).lean()
    expect(entries).toHaveLength(1)
    expect(String(entries[0].debitAccountId)).toBe(String(fjAcct._id))
    expect(String(entries[0].creditAccountId)).toBe(String(wipAcct._id))
    expect(Number(entries[0].amount)).toBeGreaterThan(0)

    // Full transfer closes the vault lot as FINISHED stock (CLOSED is not a valid status).
    const lots = await ProductionStockLot.find({ inventoryItemId: wipItem._id }).lean()
    expect(lots.every((l) => l.status === 'FINISHED')).toBe(true)
  })

  test('finished jewelry account is created once and reused for later new products', async () => {
    const { user, fineGold, silver, wipItem, service } = await seedWipMixFixture()

    const posted = await service.postAlloyMix({
      user,
      tenant: 'mg',
      karat: 22,
      targetGross: 80,
      finishedProductId: String(wipItem._id),
      lines: [
        { itemId: String(fineGold._id), gross: 50, role: 'gold', label: 'gold' },
        { itemId: String(silver._id), gross: 30, role: 'silver', label: 'silver' },
      ],
    })
    const mixId = posted.mixJob?.id || posted.mixJob?._id

    await transferVaultMixToFinishedJewelry({
      user,
      mixId,
      newProduct: { name: 'Bangle A' },
      gross: 40,
      pcs: 2,
    })
    await transferVaultMixToFinishedJewelry({
      user,
      mixId,
      newProduct: { name: 'Bangle B' },
      gross: 40,
      pcs: 2,
    })

    expect(await ChartOfAccount.countDocuments({ accountCode: '1215' })).toBe(1)
    const a = await InventoryItem.findOne({ name: 'Bangle A' }).lean()
    const b = await InventoryItem.findOne({ name: 'Bangle B' }).lean()
    expect(String(a.ledgerAccountId)).toBe(String(b.ledgerAccountId))
  })
})

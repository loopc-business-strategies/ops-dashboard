require('dotenv').config()
const mongoose = require('mongoose')

function normalize(s) {
  return String(s || '').trim().toLowerCase()
}

async function run() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('MONGO_URI_CG not configured')

  await mongoose.connect(uri)
  const db = mongoose.connection.getClient().db()

  const users = db.collection('users')
  const chart = db.collection('chartofaccounts')
  const customers = db.collection('customers')
  const vendors = db.collection('vendors')

  const actor = await users.findOne({ isActive: { $ne: false } }) || await users.findOne({})
  if (!actor?._id) throw new Error('No user found in CG to use as createdBy')

  // Strict cleanup: remove only exact ooo/mark names in CG.
  const exactNames = ['ooo', 'mark']
  const exactNameRegexes = exactNames.map((n) => new RegExp(`^${n}$`, 'i'))

  const rmCustomers = await customers.deleteMany({ name: { $in: exactNameRegexes } })
  const rmVendors = await vendors.deleteMany({ name: { $in: exactNameRegexes } })
  const rmAccounts = await chart.deleteMany({ accountName: { $in: exactNameRegexes } })

  // Ensure debtor account 1301
  let debtor = await chart.findOne({ accountCode: '1301' })
  if (!debtor) {
    const doc = {
      accountName: 'test account (Debtor)',
      accountCode: '1301',
      accountType: 'Asset',
      parentAccountId: null,
      currency: 'USD',
      isActive: true,
      description: 'Restored test debtor account for CG',
      openingBalance: 0,
      department: '',
      createdBy: actor._id,
      usedInTransactions: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    }
    const ins = await chart.insertOne(doc)
    debtor = { ...doc, _id: ins.insertedId }
  } else {
    await chart.updateOne(
      { _id: debtor._id },
      {
        $set: {
          accountName: debtor.accountName || 'test account (Debtor)',
          isActive: true,
          updatedAt: new Date(),
        },
      }
    )
  }

  // Ensure creditor account 2300
  let creditor = await chart.findOne({ accountCode: '2300' })
  if (!creditor) {
    const doc = {
      accountName: 'suplier test (Creditor)',
      accountCode: '2300',
      accountType: 'Liability',
      parentAccountId: null,
      currency: 'USD',
      isActive: true,
      description: 'Restored test creditor account for CG',
      openingBalance: 0,
      department: '',
      createdBy: actor._id,
      usedInTransactions: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    }
    const ins = await chart.insertOne(doc)
    creditor = { ...doc, _id: ins.insertedId }
  } else {
    await chart.updateOne(
      { _id: creditor._id },
      {
        $set: {
          accountName: creditor.accountName || 'suplier test (Creditor)',
          isActive: true,
          updatedAt: new Date(),
        },
      }
    )
  }

  // Ensure customer "test account"
  const customer = await customers.findOne({ name: /^test account$/i })
  if (!customer) {
    await customers.insertOne({
      name: 'test account',
      phone: '',
      email: '',
      address: '',
      gstVat: '',
      openingBalance: 0,
      creditLimit: 0,
      paymentTermsDays: 0,
      currency: 'USD',
      notes: 'Restored for CG after cleanup',
      isActive: true,
      ledgerAccountId: debtor._id,
      createdBy: actor._id,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    })
  } else {
    await customers.updateOne(
      { _id: customer._id },
      { $set: { ledgerAccountId: debtor._id, isActive: true, updatedAt: new Date() } }
    )
  }

  // Ensure vendor "suplier test"
  const vendor = await vendors.findOne({ name: /^suplier test$/i })
  if (!vendor) {
    await vendors.insertOne({
      vendorCode: 'SUPTEST',
      name: 'suplier test',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      country: '',
      postalCode: '',
      gstVat: '',
      taxRegistrationNo: '',
      paymentTermsDays: 30,
      creditLimit: 0,
      category: 'general',
      rating: 3,
      riskLevel: 'medium',
      status: 'active',
      approvalStatus: 'approved',
      approvalHistory: [],
      preferredCurrency: 'USD',
      bankName: '',
      bankAccountNumber: '',
      iban: '',
      swiftCode: '',
      notes: 'Restored for CG after cleanup',
      tags: [],
      documents: [],
      openingBalance: 0,
      currency: 'USD',
      ledgerAccountId: creditor._id,
      isActive: true,
      createdBy: actor._id,
      updatedBy: actor._id,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    })
  } else {
    await vendors.updateOne(
      { _id: vendor._id },
      { $set: { ledgerAccountId: creditor._id, isActive: true, deletedAt: null, updatedAt: new Date() } }
    )
  }

  const verifyDebtor = await chart.findOne({ accountCode: '1301' })
  const verifyCreditor = await chart.findOne({ accountCode: '2300' })
  const verifyCustomer = await customers.findOne({ name: /^test account$/i })
  const verifyVendor = await vendors.findOne({ name: /^suplier test$/i })

  console.log('CG restore complete:')
  console.log('- Removed exact ooo customers:', rmCustomers.deletedCount || 0)
  console.log('- Removed exact mark customers:', 0)
  console.log('- Removed exact ooo/mark vendors:', rmVendors.deletedCount || 0)
  console.log('- Removed exact ooo/mark accounts:', rmAccounts.deletedCount || 0)
  console.log('- 1301 account present:', !!verifyDebtor)
  console.log('- 2300 account present:', !!verifyCreditor)
  console.log('- Customer "test account" present:', !!verifyCustomer)
  console.log('- Vendor "suplier test" present:', !!verifyVendor)

  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('Restore failed:', e.message)
  process.exit(1)
})

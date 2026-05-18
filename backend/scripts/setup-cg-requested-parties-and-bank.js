require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const now = new Date()

async function main() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('Missing CG Mongo URI')

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000 }).asPromise()
  try {
    const db = conn.getClient().db()
    const admin = await db.collection('users').findOne(
      { isActive: true, role: { $in: ['super_admin', 'admin', 'finance'] } },
      { projection: { _id: 1 } }
    )

    const [ar, ap, mainBank] = await Promise.all([
      db.collection('chartofaccounts').findOne({ accountCode: '1100', isActive: true }),
      db.collection('chartofaccounts').findOne({ accountCode: '2000', isActive: true }),
      db.collection('chartofaccounts').findOne({ accountCode: '1010', isActive: true }),
    ])

    if (!ar || !ap || !mainBank) {
      throw new Error('Required parents missing: 1100, 2000, or 1010')
    }

    const nextCode = async (base, accountType) => {
      let code = base
      while (await db.collection('chartofaccounts').findOne({ accountCode: String(code), accountType })) {
        code += 1
      }
      return String(code)
    }

    const ensureAccount = async ({ accountCode, accountName, accountType, parentAccountId, currency, description }) => {
      let account = await db.collection('chartofaccounts').findOne({ accountCode })
      if (!account) {
        const ins = await db.collection('chartofaccounts').insertOne({
          accountCode,
          accountName,
          accountType,
          parentAccountId,
          currency,
          description,
          isActive: true,
          createdBy: admin?._id || null,
          updatedBy: admin?._id || null,
          createdAt: now,
          updatedAt: now,
        })
        account = await db.collection('chartofaccounts').findOne({ _id: ins.insertedId })
      } else {
        await db.collection('chartofaccounts').updateOne(
          { _id: account._id },
          {
            $set: {
              accountName,
              accountType,
              parentAccountId,
              currency,
              description,
              isActive: true,
              updatedAt: now,
            },
          }
        )
        account = await db.collection('chartofaccounts').findOne({ _id: account._id })
      }
      return account
    }

    const bankSoms = await ensureAccount({
      accountCode: '101003',
      accountName: 'nbd soms',
      accountType: 'Asset',
      parentAccountId: mainBank._id,
      currency: 'SOMS',
      description: 'NBD SOMS bank account',
    })

    let customer = await db.collection('customers').findOne({ name: /^joshua$/i, isActive: true })
    if (!customer) {
      const customerCode = await nextCode(1300, 'Asset')
      const customerLedger = await ensureAccount({
        accountCode: customerCode,
        accountName: 'joshua (Debtor)',
        accountType: 'Asset',
        parentAccountId: ar._id,
        currency: 'USD',
        description: 'Auto-created receivable account for customer joshua',
      })
      const ins = await db.collection('customers').insertOne({
        name: 'joshua',
        phone: '',
        email: '',
        address: '',
        gstVat: '',
        openingBalance: 0,
        creditLimit: 0,
        paymentTermsDays: 0,
        currency: 'USD',
        notes: '',
        isActive: true,
        ledgerAccountId: customerLedger._id,
        createdBy: admin?._id || null,
        updatedBy: admin?._id || null,
        createdAt: now,
        updatedAt: now,
      })
      customer = await db.collection('customers').findOne({ _id: ins.insertedId })
    } else {
      let ledger = customer.ledgerAccountId ? await db.collection('chartofaccounts').findOne({ _id: customer.ledgerAccountId }) : null
      if (!ledger) {
        const customerCode = await nextCode(1300, 'Asset')
        ledger = await ensureAccount({
          accountCode: customerCode,
          accountName: 'joshua (Debtor)',
          accountType: 'Asset',
          parentAccountId: ar._id,
          currency: 'USD',
          description: 'Auto-created receivable account for customer joshua',
        })
        await db.collection('customers').updateOne({ _id: customer._id }, { $set: { ledgerAccountId: ledger._id, updatedAt: now } })
      } else {
        await db.collection('chartofaccounts').updateOne(
          { _id: ledger._id },
          { $set: { accountType: 'Asset', parentAccountId: ar._id, isActive: true, updatedAt: now } }
        )
      }
      customer = await db.collection('customers').findOne({ _id: customer._id })
    }

    let vendor = await db.collection('vendors').findOne({ name: /^mark$/i, deletedAt: null })
    if (!vendor) {
      const latestCode = await db.collection('vendors')
        .find({ deletedAt: null }, { projection: { vendorCode: 1 } })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()
      const nextNum = Number(String(latestCode[0]?.vendorCode || '').match(/(\d+)/)?.[1] || 0) + 1
      const vendorCode = `VEN-${String(nextNum).padStart(4, '0')}`
      const vendorLedgerCode = await nextCode(2300, 'Liability')
      const vendorLedger = await ensureAccount({
        accountCode: vendorLedgerCode,
        accountName: 'mark (Creditor)',
        accountType: 'Liability',
        parentAccountId: ap._id,
        currency: 'USD',
        description: 'Auto-created payable account for vendor mark',
      })
      const ins = await db.collection('vendors').insertOne({
        vendorCode,
        name: 'mark',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        gstVat: '',
        taxRegistrationNo: '',
        openingBalance: 0,
        paymentTermsDays: 30,
        creditLimit: 0,
        category: 'general',
        rating: 3,
        riskLevel: 'medium',
        status: 'active',
        approvalStatus: 'approved',
        approvalHistory: [{ status: 'approved', reason: 'Seeded by CG setup', changedBy: admin?._id || null, changedAt: now }],
        notes: '',
        tags: [],
        preferredCurrency: 'USD',
        bankName: '',
        bankAccountNumber: '',
        iban: '',
        swiftCode: '',
        currency: 'USD',
        ledgerAccountId: vendorLedger._id,
        createdBy: admin?._id || null,
        updatedBy: admin?._id || null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      vendor = await db.collection('vendors').findOne({ _id: ins.insertedId })
    } else {
      let ledger = vendor.ledgerAccountId ? await db.collection('chartofaccounts').findOne({ _id: vendor.ledgerAccountId }) : null
      if (!ledger) {
        const vendorLedgerCode = await nextCode(2300, 'Liability')
        ledger = await ensureAccount({
          accountCode: vendorLedgerCode,
          accountName: 'mark (Creditor)',
          accountType: 'Liability',
          parentAccountId: ap._id,
          currency: 'USD',
          description: 'Auto-created payable account for vendor mark',
        })
        await db.collection('vendors').updateOne(
          { _id: vendor._id },
          { $set: { ledgerAccountId: ledger._id, updatedAt: now, deletedAt: null } }
        )
      } else {
        await db.collection('chartofaccounts').updateOne(
          { _id: ledger._id },
          { $set: { accountType: 'Liability', parentAccountId: ap._id, isActive: true, updatedAt: now } }
        )
      }
      vendor = await db.collection('vendors').findOne({ _id: vendor._id })
    }

    const [customerLedger, vendorLedger] = await Promise.all([
      db.collection('chartofaccounts').findOne({ _id: customer.ledgerAccountId }, { projection: { accountCode: 1, accountName: 1, parentAccountId: 1 } }),
      db.collection('chartofaccounts').findOne({ _id: vendor.ledgerAccountId }, { projection: { accountCode: 1, accountName: 1, parentAccountId: 1 } }),
    ])

    console.log(JSON.stringify({
      bankSoms: {
        accountCode: bankSoms.accountCode,
        accountName: bankSoms.accountName,
        parentAccountId: String(bankSoms.parentAccountId || ''),
      },
      joshuaCustomer: {
        id: String(customer._id),
        name: customer.name,
        ledgerAccount: {
          accountCode: customerLedger?.accountCode,
          accountName: customerLedger?.accountName,
          parentAccountId: String(customerLedger?.parentAccountId || ''),
        },
      },
      markVendor: {
        id: String(vendor._id),
        name: vendor.name,
        vendorCode: vendor.vendorCode,
        ledgerAccount: {
          accountCode: vendorLedger?.accountCode,
          accountName: vendorLedger?.accountName,
          parentAccountId: String(vendorLedger?.parentAccountId || ''),
        },
      },
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })

require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const APPLY = process.argv.includes('--apply')

const tenants = [
  { name: 'MG', uri: process.env.MONGO_URI_MG },
  { name: 'CG', uri: process.env.MONGO_URI_CG },
  { name: 'LoopC', uri: process.env.MONGO_URI_LOOPC },
].filter((t) => !!t.uri)

const findActiveAccountByCode = async (db, accountCode) => db.collection('chartofaccounts').findOne({
  accountCode: String(accountCode),
  isDeleted: { $ne: true },
  isActive: { $ne: false },
})

const ensureMapping = async (db, payload) => {
  const existing = await db.collection('accountmappings').findOne({ mappingType: payload.mappingType })

  if (!existing) {
    if (APPLY) {
      await db.collection('accountmappings').insertOne({
        ...payload,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    return { action: 'created', before: null }
  }

  const before = {
    debitAccountId: existing.debitAccountId,
    creditAccountId: existing.creditAccountId,
    isActive: existing.isActive,
  }

  const isSame = String(existing.debitAccountId || '') === String(payload.debitAccountId)
    && String(existing.creditAccountId || '') === String(payload.creditAccountId)
    && existing.isActive !== false

  if (isSame) return { action: 'unchanged', before }

  if (APPLY) {
    await db.collection('accountmappings').updateOne(
      { _id: existing._id },
      {
        $set: {
          debitAccountId: payload.debitAccountId,
          creditAccountId: payload.creditAccountId,
          isActive: true,
          updatedAt: new Date(),
        },
      }
    )
  }

  return { action: 'updated', before }
}

const processTenant = async ({ name, uri }) => {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 12000 }).asPromise()
  const db = conn.getClient().db()

  try {
    const cash = await findActiveAccountByCode(db, '1000')
    const gain = await findActiveAccountByCode(db, '4190')
    const loss = await findActiveAccountByCode(db, '5190')

    if (!cash || !gain || !loss) {
      const missing = []
      if (!cash) missing.push('1000 Cash in Hand')
      if (!gain) missing.push('4190 Exchange Gain')
      if (!loss) missing.push('5190 Exchange Loss')
      throw new Error(`Missing required active account(s): ${missing.join(', ')}`)
    }

    const gainResult = await ensureMapping(db, {
      mappingType: 'exchange_gain',
      debitAccountId: cash._id,
      creditAccountId: gain._id,
      department: 'finance',
      description: 'Auto FX gain: debit cash in hand, credit exchange gain',
    })

    const lossResult = await ensureMapping(db, {
      mappingType: 'exchange_loss',
      debitAccountId: loss._id,
      creditAccountId: cash._id,
      department: 'finance',
      description: 'Auto FX loss: debit exchange loss, credit cash in hand',
    })

    return {
      tenant: name,
      cash: { id: String(cash._id), code: cash.accountCode, name: cash.accountName },
      gain: { id: String(gain._id), code: gain.accountCode, name: gain.accountName },
      loss: { id: String(loss._id), code: loss.accountCode, name: loss.accountName },
      exchangeGainMapping: gainResult,
      exchangeLossMapping: lossResult,
    }
  } finally {
    await conn.close()
  }
}

;(async () => {
  if (!tenants.length) throw new Error('No tenant Mongo URIs found.')

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  for (const tenant of tenants) {
    try {
      const result = await processTenant(tenant)
      console.log(`\n[${result.tenant}]`)
      console.log(`  cash account       : ${result.cash.code} ${result.cash.name}`)
      console.log(`  gain account       : ${result.gain.code} ${result.gain.name}`)
      console.log(`  loss account       : ${result.loss.code} ${result.loss.name}`)
      console.log(`  exchange_gain map  : ${result.exchangeGainMapping.action}`)
      console.log(`  exchange_loss map  : ${result.exchangeLossMapping.action}`)
    } catch (err) {
      console.log(`\n[${tenant.name}] ERROR: ${err.message}`)
    }
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to persist changes.')
  }
})().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })

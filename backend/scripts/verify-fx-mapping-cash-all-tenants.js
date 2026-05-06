require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const tenants = [
  { name: 'MG', uri: process.env.MONGO_URI_MG },
  { name: 'CG', uri: process.env.MONGO_URI_CG },
  { name: 'LoopC', uri: process.env.MONGO_URI_LOOPC },
].filter((t) => !!t.uri)

const mappingTypes = ['exchange_gain', 'exchange_loss']

;(async () => {
  for (const tenant of tenants) {
    const conn = await mongoose.createConnection(tenant.uri, { serverSelectionTimeoutMS: 12000 }).asPromise()
    const db = conn.getClient().db()

    try {
      console.log(`\n[${tenant.name}]`)
      for (const mappingType of mappingTypes) {
        const mapping = await db.collection('accountmappings').findOne({ mappingType, isActive: true })
        if (!mapping) {
          console.log(`  ${mappingType}: missing`)
          continue
        }

        const [debit, credit] = await Promise.all([
          db.collection('chartofaccounts').findOne({ _id: mapping.debitAccountId }, { projection: { accountCode: 1, accountName: 1 } }),
          db.collection('chartofaccounts').findOne({ _id: mapping.creditAccountId }, { projection: { accountCode: 1, accountName: 1 } }),
        ])

        console.log(`  ${mappingType}: DR ${debit?.accountCode || '?'} ${debit?.accountName || '?'} | CR ${credit?.accountCode || '?'} ${credit?.accountName || '?'}`)
      }
    } finally {
      await conn.close()
    }
  }
})().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

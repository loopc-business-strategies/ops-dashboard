require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

async function main() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('MONGO_URI_CG missing')

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.getClient().db()

  const rx = /test|ooo|mark|override/i

  const checks = [
    { collection: 'chartofaccounts', query: { $or: [{ accountName: rx }, { accountCode: rx }] } },
    { collection: 'customers', query: { $or: [{ name: rx }, { customerName: rx }] } },
    { collection: 'vendors', query: { $or: [{ name: rx }, { vendorName: rx }] } },
    { collection: 'transactions', query: { $or: [{ 'voucherMeta.partyName': rx }, { 'voucherMeta.partyCode': rx }, { description: rx }] } },
    { collection: 'ledgers', query: { $or: [{ description: rx }, { notes: rx }] } },
  ]

  const output = {}

  for (const check of checks) {
    const count = await db.collection(check.collection).countDocuments(check.query)
    const sample = await db.collection(check.collection).find(check.query).project({ _id: 1, accountCode: 1, accountName: 1, name: 1, description: 1, notes: 1, 'voucherMeta.partyName': 1, 'voucherMeta.partyCode': 1 }).limit(5).toArray()
    output[check.collection] = { count, sample }
  }

  console.log(JSON.stringify(output, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

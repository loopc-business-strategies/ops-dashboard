require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

async function main() {
  const conn = await mongoose.createConnection(process.env.MONGO_URI_MG, { autoIndex: false }).asPromise()
  const db = conn.db

  const cols = ['chartofaccounts', 'transactions', 'directdeals', 'ledgers', 'customers', 'vendors', 'accountmappings']
  const counts = {}
  for (const c of cols) {
    counts[c] = await db.collection(c).countDocuments({})
  }

  const txByType = await db.collection('transactions')
    .aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  console.log('MG_COUNTS', counts)
  console.log('MG_TX_BY_TYPE', txByType)

  await conn.close()
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})

require('dotenv').config()
const mongoose = require('mongoose')
const dns = require('dns')

const dnsServers = (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

if (dnsServers.length) {
  dns.setServers(dnsServers)
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI_CG)
  const db = mongoose.connection.getClient().db()

  const coa = db.collection('chartofaccounts')

  const matches = await coa.find({
    $or: [
      { accountName: /^(mark|ooo)\s*\(debtor\)$/i },
      { accountName: /^(mark|ooo)$/i },
      { accountCode: { $in: ['1300', '1302'] } },
    ],
  }).project({ accountCode: 1, accountName: 1, accountType: 1, isActive: 1 }).toArray()

  console.log('Matched accounts:')
  console.log(JSON.stringify(matches, null, 2))

  if (!matches.length) {
    console.log('No mark/ooo debtor chart accounts found in CG.')
    await mongoose.disconnect()
    return
  }

  const ids = matches.map((m) => m._id)

  const ledgers = db.collection('ledgers')
  const tx = db.collection('transactions')
  const mappings = db.collection('accountmappings')

  // Remove referencing rows first to avoid dangling references in UI calculations.
  const [lDel, tDel, mDel] = await Promise.all([
    ledgers.deleteMany({ $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }] }),
    tx.deleteMany({ $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }] }),
    mappings.deleteMany({ $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }] }),
  ])

  const coaDel = await coa.deleteMany({ _id: { $in: ids } })

  console.log('Deleted ledgers:', lDel.deletedCount || 0)
  console.log('Deleted transactions:', tDel.deletedCount || 0)
  console.log('Deleted account mappings:', mDel.deletedCount || 0)
  console.log('Deleted chart accounts:', coaDel.deletedCount || 0)

  const verify = await coa.find({
    $or: [
      { accountName: /^(mark|ooo)\s*\(debtor\)$/i },
      { accountName: /^(mark|ooo)$/i },
      { accountCode: { $in: ['1300', '1302'] } },
    ],
  }).toArray()

  console.log('Remaining matches after delete:', verify.length)

  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('Failed:', e.message)
  process.exit(1)
})

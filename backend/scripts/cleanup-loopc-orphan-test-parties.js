require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGO_URI_LOOPC
  if (!uri) throw new Error('MONGO_URI_LOOPC missing')

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.getClient().db()

  const now = new Date()
  const partyNameRx = /^(ooo|test account)$/i
  const smokeNameRx = /^SMOKE-/i
  const smokeNotesRx = /temporary smoke test/i

  const customers = await db.collection('customers').find({
    isActive: true,
    $or: [
      { name: partyNameRx },
      { name: smokeNameRx },
      { notes: smokeNotesRx },
    ],
  }).project({ _id: 1, name: 1, notes: 1 }).toArray()

  const vendors = await db.collection('vendors').find({
    isActive: true,
    $or: [
      { name: partyNameRx },
      { name: smokeNameRx },
      { notes: smokeNotesRx },
    ],
  }).project({ _id: 1, name: 1, notes: 1 }).toArray()

  const customerActions = []
  for (const c of customers) {
    const txCount = await db.collection('transactions').countDocuments({ customerId: c._id, isDeleted: { $ne: true } })
    customerActions.push({ id: String(c._id), name: c.name, txCount, action: txCount === 0 ? 'deactivate' : 'skip_in_use' })
  }

  const vendorActions = []
  for (const v of vendors) {
    const txCount = await db.collection('transactions').countDocuments({ vendorId: v._id, isDeleted: { $ne: true } })
    vendorActions.push({ id: String(v._id), name: v.name, txCount, action: txCount === 0 ? 'deactivate' : 'skip_in_use' })
  }

  let updatedCustomers = 0
  let updatedVendors = 0

  if (apply) {
    const deactivateCustomerIds = customerActions.filter((a) => a.action === 'deactivate').map((a) => new mongoose.Types.ObjectId(a.id))
    const deactivateVendorIds = vendorActions.filter((a) => a.action === 'deactivate').map((a) => new mongoose.Types.ObjectId(a.id))

    if (deactivateCustomerIds.length) {
      const res = await db.collection('customers').updateMany(
        { _id: { $in: deactivateCustomerIds } },
        { $set: { isActive: false, updatedAt: now } }
      )
      updatedCustomers = res.modifiedCount
    }

    if (deactivateVendorIds.length) {
      const res = await db.collection('vendors').updateMany(
        { _id: { $in: deactivateVendorIds } },
        { $set: { isActive: false, status: 'blacklisted', updatedAt: now } }
      )
      updatedVendors = res.modifiedCount
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry_run', customerActions, vendorActions, updatedCustomers, updatedVendors }, null, 2))
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})

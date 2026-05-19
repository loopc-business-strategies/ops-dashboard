const mongoose = require('mongoose')
const { formatPrefixedCode, parsePrefixedSequence } = require('../utils/sequentialPartyCode')

const PLACEHOLDER_NAME_RX = /^(xx|test|smoke[-_]?)/i

function sortVendorsForRenumber(vendors) {
  return [...vendors].sort((a, b) => {
    const seqA = parsePrefixedSequence(a.vendorCode, 'VEN')
    const seqB = parsePrefixedSequence(b.vendorCode, 'VEN')
    if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB
    if (seqA !== null && seqB === null) return -1
    if (seqA === null && seqB !== null) return 1
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
}

function isPlaceholderVendor(vendor) {
  const name = String(vendor?.name || '').trim()
  return PLACEHOLDER_NAME_RX.test(name) || /^xx$/i.test(name)
}

async function countVendorActivity(db, vendor) {
  const vendorId = vendor._id
  const ledgerAccountId = vendor.ledgerAccountId || null
  const [transactionCount, ledgerCount] = await Promise.all([
    db.collection('transactions').countDocuments({ vendorId, isDeleted: { $ne: true } }),
    ledgerAccountId
      ? db.collection('ledgers').countDocuments({
          isDeleted: { $ne: true },
          $or: [{ debitAccountId: ledgerAccountId }, { creditAccountId: ledgerAccountId }],
        })
      : Promise.resolve(0),
  ])
  return { transactionCount, ledgerCount }
}

async function planVendorRegistryMaintenance(db, options = {}) {
  const purgeDeleted = options.purgeDeleted !== false
  const removePlaceholders = options.removePlaceholders !== false

  const allVendors = await db.collection('vendors').find({}).toArray()
  const activeVendors = allVendors.filter((v) => !v.deletedAt)
  const deletedVendors = allVendors.filter((v) => v.deletedAt)

  const removals = []

  for (const vendor of allVendors) {
    const placeholder = removePlaceholders && isPlaceholderVendor(vendor)
    const deleted = purgeDeleted && Boolean(vendor.deletedAt)
    if (!placeholder && !deleted) continue

    const activity = await countVendorActivity(db, vendor)
    removals.push({
      id: String(vendor._id),
      name: vendor.name,
      vendorCode: vendor.vendorCode || '',
      reason: placeholder ? 'placeholder' : 'soft_deleted',
      deletedAt: vendor.deletedAt || null,
      ...activity,
      action: activity.transactionCount > 0 || activity.ledgerCount > 0 ? 'block' : 'hard_delete',
    })
  }

  const removalIds = new Set(
    removals.filter((row) => row.action === 'hard_delete').map((row) => row.id),
  )
  const remainingActive = activeVendors.filter((v) => !removalIds.has(String(v._id)))
  const sorted = sortVendorsForRenumber(remainingActive)
  const renumberPlan = sorted.map((vendor, index) => ({
    id: String(vendor._id),
    name: vendor.name,
    from: vendor.vendorCode || '',
    to: formatPrefixedCode('VEN', index + 1),
  }))

  return {
    activeBefore: activeVendors.length,
    deletedBefore: deletedVendors.length,
    removals,
    blockedRemovals: removals.filter((row) => row.action === 'block'),
    renumberPlan,
    nextAutoCode: formatPrefixedCode('VEN', renumberPlan.length + 1),
  }
}

async function applyVendorRegistryMaintenance(db, plan) {
  const now = new Date()
  let removedCount = 0
  let renumberedCount = 0

  if (plan.blockedRemovals.length) {
    const error = new Error('Cannot apply maintenance while blocked removals exist')
    error.blockedRemovals = plan.blockedRemovals
    throw error
  }

  for (const row of plan.removals) {
    if (row.action !== 'hard_delete') continue
    const vendor = await db.collection('vendors').findOne({ _id: new mongoose.Types.ObjectId(row.id) })
    if (!vendor) continue

    if (vendor.ledgerAccountId) {
      await db.collection('chartofaccounts').updateOne(
        { _id: vendor.ledgerAccountId },
        { $set: { isActive: false, updatedAt: now } },
      )
    }

    await db.collection('vendors').deleteOne({ _id: vendor._id })
    removedCount += 1
  }

  for (const row of plan.renumberPlan) {
    await db.collection('vendors').updateOne(
      { _id: new mongoose.Types.ObjectId(row.id) },
      { $set: { vendorCode: row.to, updatedAt: now } },
    )
    renumberedCount += 1
  }

  return { removedCount, renumberedCount }
}

module.exports = {
  planVendorRegistryMaintenance,
  applyVendorRegistryMaintenance,
  isPlaceholderVendor,
}

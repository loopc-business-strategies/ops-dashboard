const AccountingControls = require('../../models/AccountingControls')
const { isVoucher24HourLockFeatureEnabled } = require('../../shared/voucher24HourLock')

const CONTROLS_KEY = 'default'
const MS_24H = 24 * 60 * 60 * 1000

function make24hLockedError() {
  const err = new Error(
    'This accounting entry is locked because more than 24 hours have passed since it was created. The entry is now view-only.',
  )
  err.status = 409
  err.code = 'ACCOUNTING_ENTRY_24H_LOCKED'
  return err
}

function isPast24HourWindow(createdAt, nowMs = Date.now()) {
  if (!createdAt) return false
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return false
  return nowMs >= createdMs + MS_24H
}

function editableUntil(createdAt) {
  if (!createdAt) return null
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return null
  return new Date(createdMs + MS_24H)
}

/**
 * Resolve runtime toggle. Feature-unavailable tenants always return false.
 * Missing DB doc ⇒ default ON for feature-enabled tenants.
 */
async function getVoucher24HourLockSetting(tenant) {
  if (!isVoucher24HourLockFeatureEnabled(tenant)) return false
  const doc = await AccountingControls.findOne({ key: CONTROLS_KEY }).lean()
  if (!doc) return true
  return doc.voucher24HourLockEnabled !== false
}

async function getOrCreateAccountingControls() {
  let doc = await AccountingControls.findOne({ key: CONTROLS_KEY })
  if (doc) return doc
  try {
    doc = await AccountingControls.create({
      key: CONTROLS_KEY,
      voucher24HourLockEnabled: true,
    })
    return doc
  } catch (err) {
    if (err?.code === 11000) {
      return AccountingControls.findOne({ key: CONTROLS_KEY })
    }
    throw err
  }
}

async function setVoucher24HourLockEnabled(enabled) {
  const doc = await getOrCreateAccountingControls()
  const previous = doc.voucher24HourLockEnabled !== false
  doc.voucher24HourLockEnabled = Boolean(enabled)
  await doc.save()
  return { previous, current: doc.voucher24HourLockEnabled !== false, doc }
}

async function assertVoucher24HourLock({ tenant, createdAt } = {}) {
  if (!isVoucher24HourLockFeatureEnabled(tenant)) return
  const enabled = await getVoucher24HourLockSetting(tenant)
  if (!enabled) return
  if (!createdAt) return
  if (isPast24HourWindow(createdAt)) {
    throw make24hLockedError()
  }
}

module.exports = {
  MS_24H,
  CONTROLS_KEY,
  make24hLockedError,
  isPast24HourWindow,
  editableUntil,
  getVoucher24HourLockSetting,
  getOrCreateAccountingControls,
  setVoucher24HourLockEnabled,
  assertVoucher24HourLock,
  isVoucher24HourLockFeatureEnabled,
}

/**
 * Bridges Gold Alloy Post/Update Mix → vault lot + AlloyMixJob + Operations Production rows,
 * and Floor Allocate-to department custody moves.
 */

const { withSession, writeOpts } = require('../../utils/mongoTransaction')
const { nextStockCode } = require('../productionControl/numbering')
const { PRODUCTION_DEPARTMENT_KEYS } = require('../../constants/productionDepartments')
const AlloyMixJob = require('../../models/AlloyMixJob')
const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
const OperationsProductionEntry = require('../../models/OperationsProductionEntry')

const VAULT = 'vault_room'
const QTY_EPS = 1e-9

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function toQty(n) {
  return Math.round(Number(n || 0) * 1000) / 1000
}

function dubaiDateKey(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.MG_FLOOR_TIMEZONE || 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d instanceof Date ? d : new Date(d))
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function normalizeDept(raw) {
  const key = String(raw || '').trim().toLowerCase()
  return PRODUCTION_DEPARTMENT_KEYS.includes(key) ? key : ''
}

function sanitizeToken(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 12) || 'MIX'
}

function opsKey(mixCode, departmentKey, side, stamp) {
  return `alloy:${String(mixCode).toUpperCase()}:${departmentKey}:${side}:${stamp}`
}

async function upsertOpsRow({
  session,
  mixCode,
  departmentKey,
  date,
  batchNumber,
  side,
  weight,
  purity,
  fineGold,
  employeeName,
  actor,
  stamp,
}) {
  const floorBatchKey = opsKey(mixCode, departmentKey, side, stamp)
  const set = {
    source: 'gold_alloy',
    departmentKey,
    date,
    batchNumber: String(batchNumber || mixCode).trim(),
    departmentManagerName: actor?.name || '',
    alloyMixCode: String(mixCode || '').toUpperCase(),
  }
  const setOnInsert = {
    createdById: actor?._id || null,
    createdByName: actor?.name || '',
    employeeName: employeeName || actor?.name || '',
  }
  if (side === 'in') {
    Object.assign(set, {
      metalIn: weight,
      purity: purity ?? null,
      fineGold: fineGold ?? null,
      batchStartedAt: new Date(),
      floorInEntryId: floorBatchKey,
    })
  } else {
    Object.assign(set, {
      metalOut: weight,
      purityOut: purity ?? null,
      fineGoldOut: fineGold ?? null,
      batchOverAt: new Date(),
      floorOutEntryId: floorBatchKey,
    })
  }

  const opts = {
    ...writeOpts(session),
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  }
  let row
  try {
    row = await OperationsProductionEntry.findOneAndUpdate(
      { floorBatchKey },
      { $set: set, $setOnInsert: setOnInsert },
      opts,
    )
  } catch (err) {
    if (err?.code !== 11000) throw err
    row = await OperationsProductionEntry.findOneAndUpdate(
      { floorBatchKey },
      { $set: set },
      { ...opts, upsert: false },
    )
  }
  if (!row) return null
  if (row.metalIn != null && row.metalOut != null) {
    row.metalLoss = Math.max(0, toQty(row.metalIn - row.metalOut))
    await row.save(writeOpts(session))
  }
  return row
}

async function softDeleteOpsForMix({ session, mixCode, actor, reason }) {
  const code = String(mixCode || '').toUpperCase()
  if (!code) return 0
  const rows = await withSession(
    OperationsProductionEntry.find({
      $or: [
        { alloyMixCode: code },
        { floorBatchKey: { $regex: `^alloy:${code}:` } },
      ],
    }),
    session,
  )
  const deletedAt = new Date()
  let n = 0
  for (const row of rows || []) {
    // Ops entries have no isDeleted — remove gold_alloy rows for this mix.
    if (String(row.source || '') !== 'gold_alloy' && !String(row.floorBatchKey || '').startsWith(`alloy:${code}:`)) {
      continue
    }
    await row.deleteOne(writeOpts(session))
    n += 1
  }
  void deletedAt
  void actor
  void reason
  return n
}

async function nextMixCode(session) {
  const day = dubaiDateKey().replace(/-/g, '').slice(2)
  const prefix = `AMX-${day}-`
  const last = await withSession(
    AlloyMixJob.findOne({ mixCode: new RegExp(`^${prefix}`) })
      .sort({ mixCode: -1 })
      .select('mixCode')
      .lean(),
    session,
  )
  let seq = 1
  if (last?.mixCode) {
    const part = String(last.mixCode).split('-').pop()
    const n = parseInt(part, 10)
    if (Number.isFinite(n)) seq = n + 1
  }
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/**
 * After ERP postAlloyMix succeeds: mint vault lot + Mix Job + vault Ops IN.
 */
async function createJobFromPostedMix({
  user,
  session = null,
  postResult,
  karat,
  finishedPurity = null,
} = {}) {
  if (!postResult?.success || !postResult?.finishedProduct?.id) {
    return null
  }

  const reasonBase = String(postResult.reason || '').trim()
  const targetGross = toQty(postResult.targetGross)
  const metalLossGross = toQty(postResult.metalLossGross || 0)
  const finishedId = postResult.finishedProduct.id
  const finishedName = postResult.finishedProduct.name || ''
  const actorId = user?._id || null
  const actorName = user?.name || ''

  const mixCode = await nextMixCode(session)
  const purityLabel = finishedPurity != null && Number(finishedPurity) > 0
    ? String(Math.round(Number(finishedPurity) * 1000) / 10)
    : ''
  const purityPct = finishedPurity != null && Number(finishedPurity) > 0
    ? Math.round(Number(finishedPurity) * 10000) / 100
    : null
  const fineGold = purityPct != null ? toQty((targetGross * purityPct) / 100) : null

  let stockCode = `AMX-${sanitizeToken(mixCode)}`
  const clash = await withSession(
    ProductionStockLot.findOne({ stockCode }).select('_id').lean(),
    session,
  )
  if (clash) {
    stockCode = await nextStockCode(ProductionStockLot, session)
  }

  const idempotencyKey = `alloy-mix:${reasonBase}`
  let lot = await withSession(
    ProductionStockLot.findOne({ idempotencyKey }),
    session,
  )
  if (!lot) {
    try {
      ;[lot] = await ProductionStockLot.create(
        [
          {
            stockCode,
            purchaseRef: mixCode,
            supplier: 'Gold Alloy',
            purchaseDate: new Date(),
            product: finishedName || 'Alloy mix',
            productCode: '',
            category: `alloyMix=${mixCode};karat=${Number(karat) || ''}`,
            quantity: 1,
            grossWeight: targetGross,
            netWeight: targetGross,
            metalType: 'Gold',
            purity: purityLabel,
            remarks: `Gold alloy mix ${mixCode}: ${reasonBase}`,
            receivedById: actorId,
            receivedByName: actorName,
            status: 'NEW_STOCK',
            inventoryItemId: finishedId,
            createdById: actorId,
            createdByName: actorName,
            version: 0,
            idempotencyKey,
          },
        ],
        writeOpts(session),
      )
      await ProductionStockStatusEvent.create(
        [
          {
            stockLotId: lot._id,
            stockCode: lot.stockCode,
            fromStatus: '',
            toStatus: 'NEW_STOCK',
            reason: `Alloy mix posted ${mixCode}`,
            actorId,
            actorName,
          },
        ],
        writeOpts(session),
      )
    } catch (err) {
      if (err?.code === 11000) {
        lot = await withSession(ProductionStockLot.findOne({ idempotencyKey }), session)
      } else {
        throw err
      }
    }
  }

  const [job] = await AlloyMixJob.create(
    [
      {
        mixCode,
        reasonBase,
        karat: Number(karat) || 0,
        targetGross,
        metalLossGross,
        finishedProductId: finishedId,
        finishedProductName: finishedName,
        purity: purityPct,
        stockLotId: lot?._id || null,
        stockCode: lot?.stockCode || stockCode,
        status: 'in_vault',
        currentDepartment: VAULT,
        history: [{
          at: new Date(),
          action: /updated/i.test(reasonBase) ? 'update' : 'post',
          fromDepartment: '',
          toDepartment: VAULT,
          note: reasonBase,
          actorId,
          actorName,
        }],
        createdById: actorId,
        createdByName: actorName,
        updatedById: actorId,
        updatedByName: actorName,
      },
    ],
    writeOpts(session),
  )

  const date = dubaiDateKey()
  await upsertOpsRow({
    session,
    mixCode,
    departmentKey: VAULT,
    date,
    batchNumber: mixCode,
    side: 'in',
    weight: targetGross,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp: 'post',
  })

  return {
    job,
    lot,
    mixCode,
  }
}

/**
 * Before / during reverse: require in_vault (or already closed), cancel lot, delete ops, close job.
 */
async function closeJobForReverse({
  user,
  session = null,
  reasonBase,
  allowMissing = true,
  force = false,
} = {}) {
  const reason = String(reasonBase || '').trim()
  if (!reason) return null

  const job = await withSession(
    AlloyMixJob.findOne({ reasonBase: reason, isDeleted: { $ne: true } }),
    session,
  )
  if (!job) {
    if (allowMissing) return null
    throw httpError(404, 'Alloy mix job not found for this posted mix')
  }

  if (!force && job.status !== 'in_vault' && job.status !== 'closed') {
    throw httpError(
      400,
      `Cannot reverse/update mix ${job.mixCode}: currently in ${job.currentDepartment}. `
      + 'Allocate back to Vault Room first.',
    )
  }

  if (job.stockLotId) {
    const lot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
    if (lot && String(lot.status || '') !== 'CANCELLED') {
      const fromStatus = lot.status
      lot.status = 'CANCELLED'
      lot.remarks = `${lot.remarks || ''} | Reversed alloy mix ${job.mixCode}`.trim()
      await lot.save(writeOpts(session))
      await ProductionStockStatusEvent.create(
        [
          {
            stockLotId: lot._id,
            stockCode: lot.stockCode,
            fromStatus,
            toStatus: 'CANCELLED',
            reason: `Alloy mix reversed ${job.mixCode}`,
            actorId: user?._id || null,
            actorName: user?.name || '',
          },
        ],
        writeOpts(session),
      )
    }
  }

  await softDeleteOpsForMix({
    session,
    mixCode: job.mixCode,
    actor: user,
    reason: `Reversed ${reason}`,
  })

  job.status = 'closed'
  job.closedAt = new Date()
  job.isDeleted = true
  job.deletedAt = new Date()
  job.deletedBy = user?._id || null
  job.deleteReason = `Reversed: ${reason}`
  job.updatedById = user?._id || null
  job.updatedByName = user?.name || ''
  job.history.push({
    at: new Date(),
    action: 'close',
    fromDepartment: job.currentDepartment,
    toDepartment: '',
    note: 'Reversed / closed for update',
    actorId: user?._id || null,
    actorName: user?.name || '',
  })
  await job.save(writeOpts(session))
  return job
}

async function findOpenJobByReason(reasonBase, session = null) {
  return withSession(
    AlloyMixJob.findOne({
      reasonBase: String(reasonBase || '').trim(),
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }),
    session,
  )
}

async function assertJobUpdatableByReason(reasonBase, session = null) {
  const job = await findOpenJobByReason(reasonBase, session)
  if (!job) return null
  if (job.status !== 'in_vault' || job.currentDepartment !== VAULT) {
    throw httpError(
      400,
      `Mix ${job.mixCode} is in ${job.currentDepartment}. Return it to Vault Room before Update mix.`,
    )
  }
  return job
}

/**
 * Floor: move mix from current department to next (including back to vault).
 */
async function allocateMixJob({
  user,
  mixId,
  toDepartment,
  note = '',
  session = null,
} = {}) {
  if (!user?._id) throw httpError(401, 'Unauthorized')
  const dest = normalizeDept(toDepartment)
  if (!dest) throw httpError(400, 'Select a valid department')

  const job = await withSession(
    AlloyMixJob.findOne({
      $or: [
        { _id: mixId },
        { mixCode: String(mixId || '').toUpperCase() },
      ],
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }),
    session,
  )
  if (!job) throw httpError(404, 'Alloy mix job not found')

  const from = job.currentDepartment
  if (from === dest) {
    throw httpError(400, `Mix is already in ${dest}`)
  }

  const weight = toQty(job.targetGross)
  const purityPct = job.purity != null ? Number(job.purity) : null
  const fineGold = purityPct != null ? toQty((weight * purityPct) / 100) : null
  const date = dubaiDateKey()
  const stamp = `${Date.now()}`

  await upsertOpsRow({
    session,
    mixCode: job.mixCode,
    departmentKey: from,
    date,
    batchNumber: job.mixCode,
    side: 'out',
    weight,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
  })
  await upsertOpsRow({
    session,
    mixCode: job.mixCode,
    departmentKey: dest,
    date,
    batchNumber: job.mixCode,
    side: 'in',
    weight,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
  })

  const action = dest === VAULT ? 'return_vault' : 'allocate'
  job.history.push({
    at: new Date(),
    action,
    fromDepartment: from,
    toDepartment: dest,
    note: String(note || '').trim(),
    actorId: user._id,
    actorName: user.name || '',
  })
  job.currentDepartment = dest
  job.status = dest === VAULT ? 'in_vault' : 'in_department'
  job.updatedById = user._id
  job.updatedByName = user.name || ''
  await job.save(writeOpts(session))

  if (job.stockLotId) {
    const lot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
    if (lot) {
      lot.remarks = `Alloy ${job.mixCode} @ ${dest}`
      if (dest === VAULT && lot.status !== 'NEW_STOCK') {
        const fromStatus = lot.status
        lot.status = 'NEW_STOCK'
        await lot.save(writeOpts(session))
        await ProductionStockStatusEvent.create(
          [
            {
              stockLotId: lot._id,
              stockCode: lot.stockCode,
              fromStatus,
              toStatus: 'NEW_STOCK',
              reason: `Returned to vault ${job.mixCode}`,
              actorId: user._id,
              actorName: user.name || '',
            },
          ],
          writeOpts(session),
        )
      } else {
        await lot.save(writeOpts(session))
      }
    }
  }

  return job
}

async function listMixJobs({
  department = '',
  status = '',
  includeClosed = false,
} = {}) {
  const filter = {}
  if (!includeClosed) {
    filter.isDeleted = { $ne: true }
    filter.status = { $ne: 'closed' }
  }
  const dept = normalizeDept(department)
  if (dept) filter.currentDepartment = dept
  if (status && ALLOY_MIX_JOB_STATUSES_SAFE.includes(status)) {
    filter.status = status
  }
  return AlloyMixJob.find(filter).sort({ updatedAt: -1 }).limit(200).lean()
}

const ALLOY_MIX_JOB_STATUSES_SAFE = ['in_vault', 'in_department', 'closed']

function serializeJob(job) {
  if (!job) return null
  const row = typeof job.toObject === 'function' ? job.toObject() : job
  return {
    id: String(row._id),
    mixCode: row.mixCode,
    reasonBase: row.reasonBase,
    karat: row.karat,
    targetGross: row.targetGross,
    metalLossGross: row.metalLossGross,
    finishedProductId: row.finishedProductId ? String(row.finishedProductId) : '',
    finishedProductName: row.finishedProductName || '',
    purity: row.purity,
    stockLotId: row.stockLotId ? String(row.stockLotId) : '',
    stockCode: row.stockCode || '',
    status: row.status,
    currentDepartment: row.currentDepartment,
    canUpdateMix: row.status === 'in_vault' && row.currentDepartment === VAULT && !row.isDeleted,
    history: row.history || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

module.exports = {
  VAULT,
  createJobFromPostedMix,
  closeJobForReverse,
  assertJobUpdatableByReason,
  findOpenJobByReason,
  allocateMixJob,
  listMixJobs,
  serializeJob,
  dubaiDateKey,
  normalizeDept,
  PRODUCTION_DEPARTMENT_KEYS,
  QTY_EPS,
}

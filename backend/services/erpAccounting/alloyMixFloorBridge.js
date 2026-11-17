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

const { MIX_CODE_PREFIX, isAlloyMixBatchCode } = require('./alloyMixBatchCode')

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

/** Normalize Post Mix consumed rows into AlloyMixJob.inputComponents. */
function buildInputComponents(consumed = []) {
  return (Array.isArray(consumed) ? consumed : [])
    .map((row) => {
      const gross = toQty(row?.gross)
      if (!(gross > QTY_EPS)) return null
      const name = String(row?.name || row?.consumeLabel || row?.label || '').trim()
      if (!name) return null
      return {
        itemId: row?.itemId || null,
        name,
        role: String(row?.role || '').trim().toLowerCase(),
        label: String(row?.label || row?.consumeLabel || '').trim(),
        gross,
      }
    })
    .filter(Boolean)
}

/** Scale input grams when a mix is partially allocated (ratio = move / available). */
function scaleInputComponents(components = [], ratio = 1) {
  const r = Number(ratio)
  if (!(r > 0) || !Number.isFinite(r)) return []
  return (Array.isArray(components) ? components : [])
    .map((row) => {
      const gross = toQty(Number(row?.gross || 0) * r)
      if (!(gross > QTY_EPS)) return null
      return {
        itemId: row?.itemId || null,
        name: String(row?.name || '').trim(),
        role: String(row?.role || '').trim(),
        label: String(row?.label || '').trim(),
        gross,
      }
    })
    .filter(Boolean)
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

/** Next mix/batch code: BMG-0001, BMG-0002, … continuing in order across days. */
async function nextMixCode(session) {
  const prefix = MIX_CODE_PREFIX
  const last = await withSession(
    AlloyMixJob.findOne({ mixCode: new RegExp(`^${prefix}\\d+$`, 'i') })
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
  const inputComponents = buildInputComponents(postResult.consumed)
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

  let stockCode = mixCode
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
            batchNumber: mixCode,
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
        inputComponents,
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

function jobInVaultCustody(job) {
  return Boolean(
    job
    && !job.isDeleted
    && job.status === 'in_vault'
    && job.currentDepartment === VAULT,
  )
}

/** BFS open (non-closed) descendants for partial-allocate child trees. */
async function listOpenDescendantJobs(rootId, session = null) {
  if (!rootId) return []
  const out = []
  let frontier = [rootId]
  while (frontier.length) {
    const kids = await withSession(
      AlloyMixJob.find({
        parentJobId: { $in: frontier },
        isDeleted: { $ne: true },
        status: { $ne: 'closed' },
      }),
      session,
    )
    const list = Array.isArray(kids) ? kids : []
    if (!list.length) break
    out.push(...list)
    frontier = list.map((row) => row._id)
  }
  return out
}

async function assertDescendantsInVault(job, session = null) {
  const descendants = await listOpenDescendantJobs(job?._id, session)
  const onFloor = descendants.filter((row) => !jobInVaultCustody(row))
  if (onFloor.length) {
    const sample = onFloor
      .slice(0, 3)
      .map((row) => `${row.mixCode}@${row.currentDepartment}`)
      .join(', ')
    throw httpError(
      400,
      `Cannot reverse/update mix ${job.mixCode}: split portion still on floor (${sample}). `
      + 'Allocate child mix(es) back to Vault Room first.',
    )
  }
  return descendants
}

async function closeSingleJobRecord(job, {
  user,
  session = null,
  reason = '',
  note = 'Reversed / closed for update',
} = {}) {
  if (!job || job.isDeleted || job.status === 'closed') return job

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
    reason: reason || `Reversed ${job.mixCode}`,
  })

  job.status = 'closed'
  job.closedAt = new Date()
  job.isDeleted = true
  job.deletedAt = new Date()
  job.deletedBy = user?._id || null
  job.deleteReason = reason ? `Reversed: ${reason}` : `Reversed: ${job.mixCode}`
  job.updatedById = user?._id || null
  job.updatedByName = user?.name || ''
  job.history.push({
    at: new Date(),
    action: 'close',
    fromDepartment: job.currentDepartment,
    toDepartment: '',
    note,
    actorId: user?._id || null,
    actorName: user?.name || '',
  })
  await job.save(writeOpts(session))
  return job
}

/**
 * Before / during reverse: require in_vault (or already closed), cancel lot, delete ops, close job.
 * Also closes in-vault partial-allocate descendants so ERP reverse cannot orphan floor/vault splits.
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

  const descendants = force
    ? await listOpenDescendantJobs(job._id, session)
    : await assertDescendantsInVault(job, session)

  // Deepest-first so child lots/ops clear before parent.
  for (const child of [...descendants].reverse()) {
    await closeSingleJobRecord(child, {
      user,
      session,
      reason,
      note: `Reversed with parent ${job.mixCode}`,
    })
  }

  await closeSingleJobRecord(job, {
    user,
    session,
    reason,
    note: 'Reversed / closed for update',
  })
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
  await assertDescendantsInVault(job, session)
  return job
}

async function touchLotDepartment({
  session,
  lotId,
  mixCode,
  dest,
  actorId,
  actorName,
}) {
  if (!lotId) return null
  const lot = await withSession(ProductionStockLot.findById(lotId), session)
  if (!lot) return null
  lot.remarks = `Alloy ${mixCode} @ ${dest}`
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
          reason: `Returned to vault ${mixCode}`,
          actorId,
          actorName,
        },
      ],
      writeOpts(session),
    )
  } else {
    await lot.save(writeOpts(session))
  }
  return lot
}

/**
 * Floor: move mix from current department to next (including back to vault).
 * Optional `weight` < job.targetGross splits a child Mix Job to the destination
 * and leaves the remainder in place.
 */
async function allocateMixJob({
  user,
  mixId,
  toDepartment,
  note = '',
  weight: weightRaw = null,
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
  if (job.status === 'pending_receive') {
    throw httpError(
      409,
      `Mix ${job.mixCode} is waiting for receive approval in ${job.currentDepartment}. `
        + 'Approve or reject it on that department tablet first.',
    )
  }

  const from = job.currentDepartment
  if (from === dest) {
    throw httpError(400, `Mix is already in ${dest}`)
  }

  const available = toQty(job.targetGross)
  if (!(available > QTY_EPS)) {
    throw httpError(400, 'Mix has no remaining weight to allocate')
  }

  let moveWeight = available
  if (weightRaw != null && weightRaw !== '') {
    moveWeight = toQty(weightRaw)
    if (!(moveWeight > QTY_EPS)) {
      throw httpError(400, 'Allocate weight must be positive')
    }
    if (moveWeight > available + QTY_EPS) {
      throw httpError(400, `Only ${available} g available to allocate`)
    }
  }
  const isPartial = moveWeight + QTY_EPS < available
  const remainWeight = toQty(available - moveWeight)

  const purityPct = job.purity != null ? Number(job.purity) : null
  const fineGold = purityPct != null ? toQty((moveWeight * purityPct) / 100) : null
  const date = dubaiDateKey()
  const stamp = `${Date.now()}`
  const noteText = [
    String(note || '').trim(),
    isPartial ? `partial ${moveWeight} g` : '',
  ].filter(Boolean).join(' · ')

  const action = dest === VAULT ? 'return_vault' : 'allocate'
  /** Floor dests wait for receive Approve/Reject; vault return is immediate. */
  const offerReceive = dest !== VAULT
  const childStatus = dest === VAULT ? 'in_vault' : 'pending_receive'

  if (isPartial) {
    const childCode = await nextMixCode(session)
    let childLot = null
    if (job.stockLotId) {
      const parentLot = await withSession(ProductionStockLot.findById(job.stockLotId), session)
      if (parentLot) {
        parentLot.grossWeight = remainWeight
        parentLot.netWeight = remainWeight
        parentLot.remarks = `Alloy ${job.mixCode} remainder @ ${from}`
        await parentLot.save(writeOpts(session))

        let childStockCode = `${parentLot.stockCode}-P`
        const clash = await withSession(
          ProductionStockLot.findOne({ stockCode: childStockCode }).select('_id').lean(),
          session,
        )
        if (clash) {
          childStockCode = await nextStockCode(ProductionStockLot, session)
        }
        ;[childLot] = await ProductionStockLot.create(
          [
            {
              stockCode: childStockCode,
              purchaseRef: childCode,
              batchNumber: childCode,
              supplier: 'Gold Alloy split',
              purchaseDate: new Date(),
              product: job.finishedProductName || parentLot.product || 'Alloy mix',
              productCode: parentLot.productCode || '',
              category: parentLot.category || '',
              quantity: 1,
              grossWeight: moveWeight,
              netWeight: moveWeight,
              metalType: parentLot.metalType || 'Gold',
              purity: parentLot.purity || '',
              remarks: `Split from ${job.mixCode} → ${dest}`,
              receivedById: user._id,
              receivedByName: user.name || '',
              status: dest === VAULT ? 'NEW_STOCK' : (parentLot.status || 'NEW_STOCK'),
              inventoryItemId: job.finishedProductId,
              parentLotId: parentLot._id,
              createdById: user._id,
              createdByName: user.name || '',
              version: 0,
              idempotencyKey: `alloy-split:${job.mixCode}:${stamp}`,
            },
          ],
          writeOpts(session),
        )
        parentLot.childLotIds = [...(parentLot.childLotIds || []), childLot._id]
        await parentLot.save(writeOpts(session))
      }
    }

    const splitRatio = available > QTY_EPS ? moveWeight / available : 1
    const childInputs = scaleInputComponents(job.inputComponents, splitRatio)
    const remainInputs = scaleInputComponents(job.inputComponents, remainWeight / available)

    const [child] = await AlloyMixJob.create(
      [
        {
          mixCode: childCode,
          reasonBase: `${job.reasonBase} · split ${moveWeight} g`,
          karat: job.karat,
          targetGross: moveWeight,
          metalLossGross: 0,
          finishedProductId: job.finishedProductId,
          finishedProductName: job.finishedProductName,
          inputComponents: childInputs,
          purity: job.purity,
          stockLotId: childLot?._id || null,
          stockCode: childLot?.stockCode || '',
          parentJobId: job._id,
          status: childStatus,
          currentDepartment: dest,
          pendingFromDepartment: offerReceive ? from : '',
          history: [{
            at: new Date(),
            action,
            fromDepartment: from,
            toDepartment: dest,
            note: noteText || `Split from ${job.mixCode}`,
            actorId: user._id,
            actorName: user.name || '',
          }],
          createdById: user._id,
          createdByName: user.name || '',
          updatedById: user._id,
          updatedByName: user.name || '',
        },
      ],
      writeOpts(session),
    )

    await upsertOpsRow({
      session,
      mixCode: job.mixCode,
      departmentKey: from,
      date,
      batchNumber: job.mixCode,
      side: 'out',
      weight: moveWeight,
      purity: purityPct,
      fineGold,
      actor: user,
      stamp,
    })
    // Dest Metal IN / lot touch wait until receive Approve (except vault).
    if (!offerReceive) {
      await upsertOpsRow({
        session,
        mixCode: child.mixCode,
        departmentKey: dest,
        date,
        batchNumber: child.mixCode,
        side: 'in',
        weight: moveWeight,
        purity: purityPct,
        fineGold,
        actor: user,
        stamp,
      })
    }

    job.targetGross = remainWeight
    job.inputComponents = remainInputs
    job.history.push({
      at: new Date(),
      action: 'allocate',
      fromDepartment: from,
      toDepartment: dest,
      note: noteText || `Split ${moveWeight} g → ${child.mixCode}`,
      actorId: user._id,
      actorName: user.name || '',
    })
    job.updatedById = user._id
    job.updatedByName = user.name || ''
    await job.save(writeOpts(session))

    return { parent: job, child, partial: true, pendingReceive: offerReceive }
  }

  await upsertOpsRow({
    session,
    mixCode: job.mixCode,
    departmentKey: from,
    date,
    batchNumber: job.mixCode,
    side: 'out',
    weight: moveWeight,
    purity: purityPct,
    fineGold,
    actor: user,
    stamp,
  })
  if (!offerReceive) {
    await upsertOpsRow({
      session,
      mixCode: job.mixCode,
      departmentKey: dest,
      date,
      batchNumber: job.mixCode,
      side: 'in',
      weight: moveWeight,
      purity: purityPct,
      fineGold,
      actor: user,
      stamp,
    })
  }

  job.history.push({
    at: new Date(),
    action,
    fromDepartment: from,
    toDepartment: dest,
    note: noteText,
    actorId: user._id,
    actorName: user.name || '',
  })
  job.currentDepartment = dest
  job.status = dest === VAULT ? 'in_vault' : 'pending_receive'
  job.pendingFromDepartment = offerReceive ? from : ''
  job.updatedById = user._id
  job.updatedByName = user.name || ''
  await job.save(writeOpts(session))

  if (!offerReceive) {
    await touchLotDepartment({
      session,
      lotId: job.stockLotId,
      mixCode: job.mixCode,
      dest,
      actorId: user._id,
      actorName: user.name || '',
    })
  }

  return job
}

/**
 * Destination department Accept/Reject an offered alloy mix (pending_receive).
 * Approve → in_department + gold_alloy Ops IN + seed Metal In for FM approval
 * (FM approve attaches to that Ops row — does not create a second Melting Metal IN).
 * Reject → return to pendingFromDepartment (usually vault).
 */
async function receiveMixJob({
  user,
  mixId,
  decision,
  note = '',
  actorDepartment = '',
  session = null,
} = {}) {
  if (!user?._id) throw httpError(401, 'Unauthorized')
  const decided = String(decision || '').trim().toUpperCase()
  if (decided !== 'APPROVED' && decided !== 'REJECTED') {
    throw httpError(400, 'decision must be APPROVED or REJECTED')
  }

  const job = await withSession(
    AlloyMixJob.findOne({
      $or: [
        { _id: mixId },
        { mixCode: String(mixId || '').toUpperCase() },
      ],
      isDeleted: { $ne: true },
      status: 'pending_receive',
    }),
    session,
  )
  if (!job) throw httpError(404, 'No pending alloy mix receive found')

  const dest = job.currentDepartment
  const actorDept = normalizeDept(actorDepartment)
  if (actorDept && actorDept !== dest && user.role !== 'super_admin') {
    throw httpError(403, `Only ${dest} operators can approve or reject this receive`)
  }
  const from = normalizeDept(job.pendingFromDepartment) || VAULT
  const purityPct = job.purity != null ? Number(job.purity) : null
  const weight = toQty(job.targetGross)
  const fineGold = purityPct != null ? toQty((weight * purityPct) / 100) : null
  const date = dubaiDateKey()
  const stamp = `recv-${Date.now()}`
  const noteText = String(note || '').trim()

  if (decided === 'REJECTED') {
    job.history.push({
      at: new Date(),
      action: 'receive_reject',
      fromDepartment: dest,
      toDepartment: from,
      note: noteText || 'Receive rejected',
      actorId: user._id,
      actorName: user.name || '',
    })
    job.currentDepartment = from
    job.status = from === VAULT ? 'in_vault' : 'in_department'
    job.pendingFromDepartment = ''
    job.updatedById = user._id
    job.updatedByName = user.name || ''
    await job.save(writeOpts(session))
    await touchLotDepartment({
      session,
      lotId: job.stockLotId,
      mixCode: job.mixCode,
      dest: from,
      actorId: user._id,
      actorName: user.name || '',
    })
    return { job, decision: decided, metalInEntry: null }
  }

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

  job.history.push({
    at: new Date(),
    action: 'receive_approve',
    fromDepartment: from,
    toDepartment: dest,
    note: noteText || 'Receive approved',
    actorId: user._id,
    actorName: user.name || '',
  })
  job.status = 'in_department'
  job.pendingFromDepartment = ''
  job.updatedById = user._id
  job.updatedByName = user.name || ''
  await job.save(writeOpts(session))

  await touchLotDepartment({
    session,
    lotId: job.stockLotId,
    mixCode: job.mixCode,
    dest,
    actorId: user._id,
    actorName: user.name || '',
  })

  let metalInEntry = null
  try {
    const { createSystemPendingMetalIn } = require('../mgFloor/batchEntries')
    const inputLines = (Array.isArray(job.inputComponents) ? job.inputComponents : [])
      .map((c) => ({
        metal: String(c.name || c.label || '').trim(),
        qty: toQty(c.gross),
        purity: null,
      }))
      .filter((line) => line.metal && line.qty > QTY_EPS)
    const seeded = await createSystemPendingMetalIn({
      department: dest,
      batchLabel: job.mixCode,
      entryDate: date,
      qty: weight,
      purity: purityPct,
      employeeId: user._id,
      employeeName: user.name || '',
      mixCode: job.mixCode,
      lines: inputLines.length
        ? inputLines
        : undefined,
    })
    metalInEntry = seeded?.entry || null
  } catch (err) {
    // Receive still succeeds; operator can open Metal In manually with the AMX batch.
    console.warn('[alloy-mix] seed Metal In failed:', err?.message || err)
  }

  return { job, decision: decided, metalInEntry }
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

const ALLOY_MIX_JOB_STATUSES_SAFE = ['in_vault', 'pending_receive', 'in_department', 'closed']

/** Build parentId → open children map for custody annotations. */
async function loadOpenChildrenByParent(session = null) {
  const rows = await withSession(
    AlloyMixJob.find({
      parentJobId: { $ne: null },
      isDeleted: { $ne: true },
      status: { $ne: 'closed' },
    }).select('_id parentJobId status currentDepartment isDeleted mixCode').lean(),
    session,
  )
  const byParent = new Map()
  for (const row of rows || []) {
    const key = String(row.parentJobId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(row)
  }
  return byParent
}

function hasOpenFloorDescendant(rootId, childrenByParent) {
  if (!rootId || !childrenByParent) return false
  const stack = [String(rootId)]
  const seen = new Set()
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    for (const kid of childrenByParent.get(id) || []) {
      if (!jobInVaultCustody(kid)) return true
      stack.push(String(kid._id))
    }
  }
  return false
}

function serializeJob(job, {
  hasOpenFloorDescendants = false,
  childrenByParent = null,
} = {}) {
  if (!job) return null
  const row = typeof job.toObject === 'function' ? job.toObject() : job
  const floorDescendants = childrenByParent
    ? hasOpenFloorDescendant(row._id, childrenByParent)
    : Boolean(hasOpenFloorDescendants)
  const inVault = row.status === 'in_vault' && row.currentDepartment === VAULT && !row.isDeleted
  const pendingReceive = row.status === 'pending_receive' && !row.isDeleted
  return {
    id: String(row._id),
    mixCode: row.mixCode,
    /** Canonical batch id for Floor / Ops — same as mixCode for every alloy mix. */
    batchNumber: row.mixCode,
    reasonBase: row.reasonBase,
    karat: row.karat,
    targetGross: row.targetGross,
    metalLossGross: row.metalLossGross,
    finishedProductId: row.finishedProductId ? String(row.finishedProductId) : '',
    finishedProductName: row.finishedProductName || '',
    inputComponents: (Array.isArray(row.inputComponents) ? row.inputComponents : [])
      .map((c) => ({
        itemId: c.itemId ? String(c.itemId) : '',
        name: String(c.name || '').trim(),
        role: String(c.role || '').trim(),
        label: String(c.label || '').trim(),
        gross: toQty(c.gross),
      }))
      .filter((c) => c.name && c.gross > QTY_EPS),
    purity: row.purity,
    stockLotId: row.stockLotId ? String(row.stockLotId) : '',
    stockCode: row.stockCode || '',
    parentJobId: row.parentJobId ? String(row.parentJobId) : '',
    status: row.status,
    currentDepartment: row.currentDepartment,
    pendingFromDepartment: row.pendingFromDepartment || '',
    pendingReceive,
    hasOpenFloorDescendants: floorDescendants,
    canUpdateMix: inVault && !floorDescendants,
    /** Operator may Allocate only when mix is active on this dept (not waiting receive). */
    canAllocate: !pendingReceive && !row.isDeleted && row.status !== 'closed',
    history: row.history || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Backfill inputComponents for jobs posted before that field existed,
 * using StockMovement consume rows for the mix reasonBase.
 */
async function backfillInputComponents(jobs, session = null) {
  const list = Array.isArray(jobs) ? jobs : []
  const need = list.filter((job) => {
    const row = typeof job?.toObject === 'function' ? job.toObject() : job
    return row && !(Array.isArray(row.inputComponents) && row.inputComponents.length)
      && String(row.reasonBase || '').trim()
  })
  if (!need.length) return list

  const StockMovement = require('../../models/StockMovement')
  const reasons = [...new Set(need.map((j) => String(j.reasonBase || '').trim()).filter(Boolean))]
  const reasonMatchers = reasons.map((base) => {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`^${escaped}\\s*—\\s*consume\\b`, 'i')
  })
  const consumeMoves = reasonMatchers.length
    ? await withSession(
      StockMovement.find({
        isDeleted: { $ne: true },
        change: { $lt: 0 },
        $or: reasonMatchers.map((rx) => ({ reason: rx })),
      }).select('itemId itemName change reason').lean(),
      session,
    ).catch(() => [])
    : []

  const byReason = new Map()
  for (const move of consumeMoves || []) {
    const text = String(move.reason || '')
    const base = reasons.find((r) => text.toLowerCase().startsWith(r.toLowerCase()))
    if (!base) continue
    if (!byReason.has(base)) byReason.set(base, [])
    byReason.get(base).push({
      itemId: move.itemId || null,
      name: String(move.itemName || '').trim(),
      role: '',
      label: '',
      gross: toQty(Math.abs(Number(move.change) || 0)),
    })
  }

  const updates = []
  for (const job of need) {
    const base = String(job.reasonBase || '').trim()
    const components = (byReason.get(base) || []).filter((c) => c.name && c.gross > QTY_EPS)
    if (!components.length) continue
    job.inputComponents = components
    if (job._id) {
      updates.push(
        AlloyMixJob.updateOne(
          { _id: job._id },
          { $set: { inputComponents: components } },
          writeOpts(session),
        ).catch(() => null),
      )
    }
  }
  if (updates.length) await Promise.all(updates)
  return list
}

async function serializeJobs(jobs, session = null) {
  const list = Array.isArray(jobs) ? jobs : []
  if (!list.length) return []
  await backfillInputComponents(list, session)
  const childrenByParent = await loadOpenChildrenByParent(session)
  return list.map((job) => serializeJob(job, { childrenByParent }))
}

async function serializeAllocateResult(result, session = null) {
  if (result?.partial && result.parent && result.child) {
    const childrenByParent = await loadOpenChildrenByParent(session)
    return {
      partial: true,
      pendingReceive: Boolean(result.pendingReceive),
      job: serializeJob(result.child, { childrenByParent }),
      parentJob: serializeJob(result.parent, { childrenByParent }),
      childJob: serializeJob(result.child, { childrenByParent }),
    }
  }
  return {
    partial: false,
    pendingReceive: result?.status === 'pending_receive',
    job: serializeJob(result),
  }
}

async function serializeReceiveResult(result, session = null) {
  return {
    decision: result?.decision || null,
    job: serializeJob(result?.job, {
      childrenByParent: await loadOpenChildrenByParent(session),
    }),
    metalInEntryId: result?.metalInEntry?.entryId || result?.metalInEntry?._id
      ? String(result.metalInEntry.entryId || result.metalInEntry._id)
      : null,
  }
}

module.exports = {
  VAULT,
  MIX_CODE_PREFIX,
  createJobFromPostedMix,
  closeJobForReverse,
  assertJobUpdatableByReason,
  findOpenJobByReason,
  allocateMixJob,
  receiveMixJob,
  listMixJobs,
  serializeJob,
  serializeJobs,
  serializeAllocateResult,
  serializeReceiveResult,
  buildInputComponents,
  scaleInputComponents,
  jobInVaultCustody,
  hasOpenFloorDescendant,
  isAlloyMixBatchCode,
  dubaiDateKey,
  normalizeDept,
  PRODUCTION_DEPARTMENT_KEYS,
  QTY_EPS,
}

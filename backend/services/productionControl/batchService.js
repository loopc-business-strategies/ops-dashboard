const ProductionBatch = require('../../models/ProductionBatch')
const InventoryItem = require('../../models/InventoryItem')
const StockMovement = require('../../models/StockMovement')
const ProductionAlert = require('../../models/ProductionAlert')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextBatchNumber, nextAlertNumber } = require('./numbering')
const { getActiveFlowConfig } = require('./flowConfigService')
const { AUDIT_ACTIONS, METAL_TYPES, BATCH_STATUSES } = require('./constants')
const { ProductionError } = require('./errors')
const { assertStatusTransition } = require('./statusTransitions')

function actor(req) {
  return {
    id: req.user?._id || null,
    name: req.user?.name || 'system',
  }
}

async function syncStockSafe(req, batch, toStatus, opts = {}) {
  try {
    const stockService = require('./stockService')
    await stockService.syncStockStatusForBatch(req, batch, toStatus, opts)
  } catch (err) {
    console.warn('[production-control] stock sync:', err.message)
  }
}

async function createBatch(req, input = {}) {
  const {
    metalType,
    purity = '',
    initialWeight,
    product = '',
    purpose = '',
    targetQuantity = 0,
    workOrderId = null,
    workOrderNumber = '',
    inventoryItemId = null,
    idempotencyKey = null,
  } = input

  if (!METAL_TYPES.includes(metalType)) {
    throw new ProductionError('Invalid metal type')
  }
  const weight = Number(initialWeight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('initialWeight must be a positive number')
  }

  if (idempotencyKey) {
    const existing = await ProductionBatch.findOne({ idempotencyKey }).lean()
    if (existing) return { batch: existing, reused: true }
  }

  const a = actor(req)

  const result = await runInTransaction(async (session) => {
    const batchNumber = await nextBatchNumber(ProductionBatch, metalType, session)
    const [batch] = await ProductionBatch.create(
      [
        {
          batchNumber,
          workOrderId: workOrderId || null,
          workOrderNumber: workOrderNumber || '',
          metalType,
          purity: metalType === 'Gold' ? (purity || '') : purity,
          product,
          purpose,
          targetQuantity: Number(targetQuantity) || 0,
          initialWeight: weight,
          currentWeight: weight,
          lastVerifiedWeight: weight,
          currentDepartment: 'vault',
          currentLocation: 'Vault',
          inventoryItemId: inventoryItemId || null,
          status: 'AWAITING_ISSUE',
          createdById: a.id,
          createdByName: a.name,
          version: 0,
        },
      ],
      writeOpts(session),
    )

    if (idempotencyKey) {
      batch.idempotencyKey = idempotencyKey
      await batch.save(writeOpts(session))
    }

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.BATCH_CREATED,
      detail: `Batch ${batchNumber} created (${metalType} ${purity || ''} ${weight}g)`,
      changes: { after: { batchNumber, metalType, purity, initialWeight: weight, status: 'AWAITING_ISSUE' } },
      session,
    })

    return batch
  })

  return { batch: result, reused: false }
}

/**
 * Issue metal from vault inventory into a batch (creates StockMovement + updates InventoryItem).
 * Never deletes inventory history. Idempotent via issueIdempotencyKey.
 */
async function issueFromVault(req, batchId, {
  inventoryItemId,
  weight,
  purpose = '',
  expectedVersion,
  idempotencyKey = null,
} = {}) {
  const issueWeight = Number(weight)
  if (!Number.isFinite(issueWeight) || issueWeight <= 0) {
    throw new ProductionError('Issue weight must be positive')
  }

  if (idempotencyKey) {
    const existing = await ProductionBatch.findOne({ issueIdempotencyKey: idempotencyKey })
    if (existing) return { batch: existing, reused: true }
  }

  const a = actor(req)

  const result = await runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)

    if (idempotencyKey && batch.issueIdempotencyKey === idempotencyKey) {
      return { batch, reused: true }
    }

    if (!['CREATED', 'AWAITING_ISSUE'].includes(batch.status)) {
      throw new ProductionError(
        `Cannot issue metal for batch in status ${batch.status}. Only AWAITING_ISSUE (or CREATED) is allowed.`,
      )
    }
    if (Number(batch.issuedWeight || 0) > 0) {
      throw new ProductionError(
        `Batch ${batch.batchNumber} has already been issued (${batch.issuedWeight}g). Duplicate vault issue is not allowed.`,
      )
    }
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    assertStatusTransition('batch', batch.status, 'ISSUED')

    const itemId = inventoryItemId || batch.inventoryItemId
    if (!itemId) throw new ProductionError('inventoryItemId is required to issue from vault')

    const item = await withSession(InventoryItem.findById(itemId), session)
    if (!item || item.isDeleted) throw new ProductionError('Inventory item not found', 404)
    if (Number(item.quantity) < issueWeight) {
      throw new ProductionError(`Insufficient vault stock. Available: ${item.quantity}`)
    }

    const before = Number(item.quantity)
    const after = before - issueWeight
    item.quantity = after
    item.updatedBy = a.id
    await item.save(writeOpts(session))

    await StockMovement.create(
      [
        {
          itemId: item._id,
          itemName: item.name,
          change: -issueWeight,
          quantityBefore: before,
          quantityAfter: after,
          reason: `production_issue:${batch.batchNumber}`,
          actorId: a.id,
          actorName: a.name,
        },
      ],
      writeOpts(session),
    )

    batch.inventoryItemId = item._id
    batch.issuedWeight = Number(batch.issuedWeight || 0) + issueWeight
    batch.currentWeight = issueWeight
    batch.initialWeight = batch.initialWeight || issueWeight
    batch.lastVerifiedWeight = issueWeight
    batch.status = 'ISSUED'
    batch.currentDepartment = 'vault'
    batch.currentLocation = 'Vault'
    batch.purpose = purpose || batch.purpose
    batch.startedAt = batch.startedAt || new Date()
    if (idempotencyKey) batch.issueIdempotencyKey = idempotencyKey
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.METAL_ISSUED,
      detail: `Issued ${issueWeight}g from vault inventory to ${batch.batchNumber}`,
      changes: {
        weightBefore: before,
        weightAfter: after,
        issuedWeight: issueWeight,
        inventoryItemId: String(item._id),
      },
      session,
    })

    return { batch, reused: false }
  })

  return result
}

async function holdBatch(req, batchId, { reason = '', expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }
    if (batch.status === 'HOLD') return batch

    const from = batch.status
    assertStatusTransition('batch', from, 'HOLD')
    batch.statusBeforeHold = from
    batch.status = 'HOLD'
    batch.holdReason = reason || 'Held by floor'
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.BATCH_HOLD,
      detail: `Batch ${batch.batchNumber} held: ${batch.holdReason}`,
      changes: { fromState: from, toState: 'HOLD', reason: batch.holdReason },
      session,
    })

    await syncStockSafe(req, batch, 'HOLD', { reason: batch.holdReason, session })
    return batch
  })
}

async function releaseBatch(req, batchId, { toStatus, expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (batch.status !== 'HOLD') throw new ProductionError('Batch is not on HOLD')
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const resolved = toStatus
      || batch.statusBeforeHold
      || 'WAITING'
    if (!BATCH_STATUSES.includes(resolved) || ['HOLD', 'CANCELLED'].includes(resolved)) {
      throw new ProductionError(`Invalid release status: ${resolved}`)
    }
    assertStatusTransition('batch', 'HOLD', resolved)

    batch.status = resolved
    batch.holdReason = ''
    batch.statusBeforeHold = ''
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.BATCH_RELEASED,
      detail: `Batch ${batch.batchNumber} released to ${resolved}`,
      changes: { fromState: 'HOLD', toState: resolved },
      session,
    })

    const stockStatus = resolved === 'REWORK' ? 'REWORK'
      : resolved === 'QC_FAILED' ? 'QC_FAILED'
        : resolved === 'QC' ? 'QC_PENDING'
          : 'UNDER_PROCESSING'
    await syncStockSafe(req, batch, stockStatus, { reason: `Released to ${resolved}`, session })
    return batch
  })
}

async function returnToVault(req, batchId, { weight, inventoryItemId, expectedVersion } = {}) {
  const a = actor(req)
  const returnWeight = weight != null ? Number(weight) : null

  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (batch.status === 'RETURNED_TO_VAULT') return batch
    if (['COMPLETED', 'CANCELLED'].includes(batch.status)) {
      throw new ProductionError(
        `Cannot return batch to vault in status ${batch.status}. Completed/packaged lots must use finished-stock / dispatch flow.`,
      )
    }
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const qty = returnWeight != null ? returnWeight : Number(batch.currentWeight)
    if (!Number.isFinite(qty) || qty < 0) throw new ProductionError('Invalid return weight')

    const itemId = inventoryItemId || batch.inventoryItemId
    if (itemId && qty > 0) {
      const item = await withSession(InventoryItem.findById(itemId), session)
      if (!item || item.isDeleted) throw new ProductionError('Inventory item not found', 404)
      const before = Number(item.quantity)
      const after = before + qty
      item.quantity = after
      item.updatedBy = a.id
      await item.save(writeOpts(session))

      await StockMovement.create(
        [
          {
            itemId: item._id,
            itemName: item.name,
            change: qty,
            quantityBefore: before,
            quantityAfter: after,
            reason: `production_return:${batch.batchNumber}`,
            actorId: a.id,
            actorName: a.name,
          },
        ],
        writeOpts(session),
      )
    }

    const from = batch.status
    assertStatusTransition('batch', from, 'RETURNED_TO_VAULT')
    batch.status = 'RETURNED_TO_VAULT'
    batch.currentDepartment = 'vault'
    batch.currentLocation = 'Vault'
    batch.currentHolderId = null
    batch.currentHolderName = ''
    batch.currentProcess = ''
    batch.currentWeight = qty
    batch.completedAt = new Date()
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.RETURNED_TO_VAULT,
      detail: `Batch ${batch.batchNumber} returned to vault (${qty}g)`,
      changes: { fromState: from, toState: 'RETURNED_TO_VAULT', weight: qty },
      session,
    })

    await syncStockSafe(req, batch, 'AVAILABLE', {
      reason: 'Returned to vault',
      session,
    })

    return batch
  })
}

async function raiseWeightVarianceAlert(req, batch, { expected, actual, variancePct }, session) {
  const cfg = await getActiveFlowConfig(session)
  const alertNumber = await nextAlertNumber(ProductionAlert, session)
  const [alert] = await ProductionAlert.create(
    [
      {
        alertNumber,
        category: 'weight',
        code: 'WEIGHT_VARIANCE',
        title: 'WEIGHT VARIANCE ALERT',
        message: `Batch ${batch.batchNumber}: expected ${expected}g, actual ${actual}g (${variancePct.toFixed(2)}%)`,
        severity: 'critical',
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        metadata: { expected, actual, variancePct, tolerancePct: cfg.weightTolerancePct },
        raisedById: req.user?._id || null,
        raisedByName: req.user?.name || 'system',
      },
    ],
    writeOpts(session),
  )

  await writeProductionAudit(req, {
    resource: 'ProductionAlert',
    resourceId: alert._id,
    action: AUDIT_ACTIONS.WEIGHT_VARIANCE_DETECTED,
    detail: alert.message,
    changes: { expected, actual, variancePct },
    session,
  })

  if (cfg.autoHoldOnVariance && batch.status !== 'HOLD') {
    assertStatusTransition('batch', batch.status, 'HOLD')
    batch.statusBeforeHold = batch.status
    batch.status = 'HOLD'
    batch.holdReason = `Auto-hold: weight variance ${variancePct.toFixed(2)}%`
  }

  return alert
}

const SPLIT_MERGE_ALLOWED = new Set([
  'CREATED',
  'AWAITING_ISSUE',
  'ISSUED',
  'WAITING',
  'RECEIVED',
  'HOLD',
  'RETURNED_TO_VAULT',
])

/**
 * Split a batch into child batches. Parent history is preserved (status SPLIT).
 * parts: [{ weight, product?, purpose? }, ...] — weights must sum to currentWeight.
 */
async function splitBatch(req, batchId, { parts = [], reason = '', expectedVersion } = {}) {
  if (!Array.isArray(parts) || parts.length < 2) {
    throw new ProductionError('Split requires at least two parts')
  }
  const weights = parts.map((p) => Number(p.weight))
  if (weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    throw new ProductionError('Each split part must have a positive weight')
  }

  const a = actor(req)
  return runInTransaction(async (session) => {
    const parent = await withSession(ProductionBatch.findById(batchId), session)
    if (!parent) throw new ProductionError('Batch not found', 404)
    if (!SPLIT_MERGE_ALLOWED.has(parent.status)) {
      throw new ProductionError(`Cannot split batch in status ${parent.status}`)
    }
    if (expectedVersion != null && parent.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const parentWeight = Number(parent.currentWeight || parent.initialWeight || 0)
    const sum = weights.reduce((acc, w) => acc + w, 0)
    if (Math.abs(sum - parentWeight) > 0.0001) {
      throw new ProductionError(
        `Split weights (${sum}g) must equal parent current weight (${parentWeight}g)`,
      )
    }

    assertStatusTransition('batch', parent.status, 'SPLIT')

    const children = []
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      const w = weights[i]
      const batchNumber = await nextBatchNumber(ProductionBatch, parent.metalType, session)
      const [child] = await ProductionBatch.create(
        [
          {
            batchNumber,
            workOrderId: parent.workOrderId || null,
            workOrderNumber: parent.workOrderNumber || '',
            metalType: parent.metalType,
            purity: parent.purity || '',
            product: part.product || parent.product || '',
            purpose: part.purpose || `Split from ${parent.batchNumber}` || parent.purpose || '',
            targetQuantity: Number(part.targetQuantity) || 0,
            initialWeight: w,
            currentWeight: w,
            lastVerifiedWeight: w,
            currentDepartment: parent.currentDepartment || 'vault',
            currentLocation: parent.currentLocation || 'Vault',
            inventoryItemId: parent.inventoryItemId || null,
            stockLotId: null,
            stockCode: '',
            status: 'AWAITING_ISSUE',
            parentBatchId: parent._id,
            parentBatchIds: [parent._id],
            splitFromBatchNumber: parent.batchNumber,
            createdById: a.id,
            createdByName: a.name,
            version: 0,
          },
        ],
        writeOpts(session),
      )
      children.push(child)
    }

    parent.childBatchIds = children.map((c) => c._id)
    parent.status = 'SPLIT'
    parent.currentWeight = 0
    parent.holdReason = reason || `Split into ${children.map((c) => c.batchNumber).join(', ')}`
    parent.version = (parent.version || 0) + 1
    await parent.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: parent._id,
      action: AUDIT_ACTIONS.BATCH_SPLIT,
      detail: `Batch ${parent.batchNumber} split into ${children.map((c) => c.batchNumber).join(', ')}`,
      changes: {
        parentBatchNumber: parent.batchNumber,
        children: children.map((c) => ({
          batchNumber: c.batchNumber,
          weight: c.currentWeight,
        })),
        reason: reason || '',
      },
      session,
    })

    return { parent, children }
  })
}

/**
 * Merge multiple batches into a new batch. Parents kept as MERGED with genealogy.
 */
async function mergeBatches(req, { batchIds = [], reason = '', product = '', purpose = '' } = {}) {
  if (!Array.isArray(batchIds) || batchIds.length < 2) {
    throw new ProductionError('Merge requires at least two batchIds')
  }
  const uniqueIds = [...new Set(batchIds.map(String))]
  if (uniqueIds.length < 2) throw new ProductionError('Merge requires distinct batches')

  const a = actor(req)
  return runInTransaction(async (session) => {
    const parents = []
    for (const id of uniqueIds) {
      const batch = await withSession(ProductionBatch.findById(id), session)
      if (!batch) throw new ProductionError(`Batch not found: ${id}`, 404)
      if (!SPLIT_MERGE_ALLOWED.has(batch.status)) {
        throw new ProductionError(`Cannot merge batch ${batch.batchNumber} in status ${batch.status}`)
      }
      parents.push(batch)
    }

    const metalType = parents[0].metalType
    const purity = String(parents[0].purity || '')
    for (const p of parents) {
      if (p.metalType !== metalType) {
        throw new ProductionError('Cannot merge batches with different metal types')
      }
      if (String(p.purity || '') !== purity) {
        throw new ProductionError('Cannot merge batches with different purity')
      }
      assertStatusTransition('batch', p.status, 'MERGED')
    }

    const totalWeight = parents.reduce(
      (acc, p) => acc + Number(p.currentWeight || p.initialWeight || 0),
      0,
    )
    if (!(totalWeight > 0)) throw new ProductionError('Merged weight must be positive')

    const batchNumber = await nextBatchNumber(ProductionBatch, metalType, session)
    const [merged] = await ProductionBatch.create(
      [
        {
          batchNumber,
          metalType,
          purity,
          product: product || parents.map((p) => p.product).filter(Boolean).join('+') || '',
          purpose: purpose || `Merged from ${parents.map((p) => p.batchNumber).join(', ')}`,
          targetQuantity: parents.reduce((acc, p) => acc + Number(p.targetQuantity || 0), 0),
          initialWeight: totalWeight,
          currentWeight: totalWeight,
          lastVerifiedWeight: totalWeight,
          currentDepartment: 'vault',
          currentLocation: 'Vault',
          inventoryItemId: parents[0].inventoryItemId || null,
          status: 'AWAITING_ISSUE',
          parentBatchIds: parents.map((p) => p._id),
          parentBatchId: parents[0]._id,
          createdById: a.id,
          createdByName: a.name,
          version: 0,
        },
      ],
      writeOpts(session),
    )

    for (const parent of parents) {
      parent.status = 'MERGED'
      parent.mergedIntoBatchId = merged._id
      parent.mergedIntoBatchNumber = merged.batchNumber
      parent.currentWeight = 0
      parent.childBatchIds = [...(parent.childBatchIds || []), merged._id]
      parent.holdReason = reason || `Merged into ${merged.batchNumber}`
      parent.version = (parent.version || 0) + 1
      await parent.save(writeOpts(session))
    }

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: merged._id,
      action: AUDIT_ACTIONS.BATCH_MERGED,
      detail: `Merged ${parents.map((p) => p.batchNumber).join(', ')} into ${merged.batchNumber}`,
      changes: {
        parentBatchNumbers: parents.map((p) => p.batchNumber),
        mergedBatchNumber: merged.batchNumber,
        totalWeight,
        reason: reason || '',
      },
      session,
    })

    return { merged, parents }
  })
}

module.exports = {
  ProductionError,
  createBatch,
  issueFromVault,
  holdBatch,
  releaseBatch,
  returnToVault,
  raiseWeightVarianceAlert,
  splitBatch,
  mergeBatches,
}

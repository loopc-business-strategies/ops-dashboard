const ProductionBatch = require('../../models/ProductionBatch')
const InventoryItem = require('../../models/InventoryItem')
const StockMovement = require('../../models/StockMovement')
const ProductionAlert = require('../../models/ProductionAlert')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextBatchNumber, nextAlertNumber } = require('./numbering')
const { getActiveFlowConfig } = require('./flowConfigService')
const { AUDIT_ACTIONS, METAL_TYPES } = require('./constants')

class ProductionError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
    this.name = 'ProductionError'
  }
}

function actor(req) {
  return {
    id: req.user?._id || null,
    name: req.user?.name || 'system',
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
          idempotencyKey: idempotencyKey || null,
          version: 0,
        },
      ],
      writeOpts(session),
    )

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
 * Never deletes inventory history.
 */
async function issueFromVault(req, batchId, { inventoryItemId, weight, purpose = '', expectedVersion } = {}) {
  const issueWeight = Number(weight)
  if (!Number.isFinite(issueWeight) || issueWeight <= 0) {
    throw new ProductionError('Issue weight must be positive')
  }

  const a = actor(req)

  const result = await runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(batch.status)) {
      throw new ProductionError(`Cannot issue metal for batch in status ${batch.status}`)
    }
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

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

    return batch
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
    return batch
  })
}

async function releaseBatch(req, batchId, { toStatus = 'WAITING', expectedVersion } = {}) {
  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (batch.status !== 'HOLD') throw new ProductionError('Batch is not on HOLD')
    if (expectedVersion != null && batch.version !== Number(expectedVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    batch.status = toStatus
    batch.holdReason = ''
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.BATCH_RELEASED,
      detail: `Batch ${batch.batchNumber} released to ${toStatus}`,
      changes: { fromState: 'HOLD', toState: toStatus },
      session,
    })
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
    batch.status = 'HOLD'
    batch.holdReason = `Auto-hold: weight variance ${variancePct.toFixed(2)}%`
  }

  return alert
}

module.exports = {
  ProductionError,
  createBatch,
  issueFromVault,
  holdBatch,
  releaseBatch,
  returnToVault,
  raiseWeightVarianceAlert,
}

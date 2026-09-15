const ProductionBatch = require('../../models/ProductionBatch')
const ProductionPass = require('../../models/ProductionPass')
const MetalMovement = require('../../models/MetalMovement')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextPassNumber, nextMovementNumber } = require('./numbering')
const { AUDIT_ACTIONS, OPEN_PASS_STATUSES } = require('./constants')
const { ProductionError } = require('./errors')
const { assertStatusTransition, departmentsMatch } = require('./statusTransitions')
const { getActiveFlowConfig } = require('./flowConfigService')
const { raiseWeightVarianceAlert } = require('./batchService')

function actor(req) {
  return { id: req.user?._id || null, name: req.user?.name || 'system' }
}

async function sumReservedPassWeight(batchId, session, { excludePassId = null } = {}) {
  const filter = {
    batchId,
    status: { $in: OPEN_PASS_STATUSES },
  }
  if (excludePassId) filter._id = { $ne: excludePassId }

  const passes = await withSession(ProductionPass.find(filter).select('weight'), session)
  return passes.reduce((sum, p) => sum + Number(p.weight || 0), 0)
}

async function createPass(req, input = {}) {
  const {
    batchId,
    fromDepartment,
    toDepartment,
    toPersonId = null,
    toPersonName = '',
    weight,
    purpose = '',
    machineId = null,
    machineName = '',
    idempotencyKey = null,
  } = input

  if (!batchId || !toDepartment) {
    throw new ProductionError('batchId and toDepartment are required')
  }
  const w = Number(weight)
  if (!Number.isFinite(w) || w <= 0) throw new ProductionError('Pass weight must be positive')

  if (idempotencyKey) {
    const existing = await ProductionPass.findOne({ idempotencyKey }).lean()
    if (existing) return { pass: existing, reused: true }
  }

  const a = actor(req)

  const result = await runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED', 'HOLD'].includes(batch.status)) {
      throw new ProductionError(`Cannot create pass for batch in status ${batch.status}`)
    }

    // Derive/verify source department from batch custody — do not trust client alone.
    const actualFrom = batch.currentDepartment || batch.currentLocation || 'vault'
    if (fromDepartment && !departmentsMatch(fromDepartment, actualFrom)) {
      // Write outside the transaction session so the rejection remains auditable after abort.
      await writeProductionAudit(req, {
        resource: 'ProductionPass',
        resourceId: batch._id,
        action: AUDIT_ACTIONS.PASS_REJECTED,
        detail: `Rejected pass: fromDepartment "${fromDepartment}" does not match batch location "${actualFrom}"`,
        changes: {
          attemptedFrom: fromDepartment,
          actualFrom,
          toDepartment,
          weight: w,
          batchId: String(batch._id),
        },
      })
      throw new ProductionError(
        `fromDepartment must match the batch's current department/location (${actualFrom}). Received: ${fromDepartment}`,
      )
    }
    const resolvedFrom = actualFrom

    const reserved = await sumReservedPassWeight(batch._id, session)
    const current = Number(batch.currentWeight) || 0
    const available = current - reserved
    if (w > available + 1e-9) {
      throw new ProductionError(
        `Pass weight ${w}g exceeds available transferable weight ${available}g `
        + `(current ${current}g − reserved by open passes ${reserved}g)`,
      )
    }

    const passNumber = await nextPassNumber(ProductionPass, session)
    const [pass] = await ProductionPass.create(
      [
        {
          passNumber,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          fromDepartment: resolvedFrom,
          toDepartment,
          fromPersonId: batch.currentHolderId || a.id,
          fromPersonName: batch.currentHolderName || a.name,
          toPersonId,
          toPersonName,
          metalType: batch.metalType,
          purity: batch.purity,
          weight: w,
          purpose: purpose || batch.purpose,
          machineId,
          machineName,
          status: 'REQUESTED',
          issuedById: a.id,
          issuedByName: a.name,
          idempotencyKey: idempotencyKey || null,
        },
      ],
      writeOpts(session),
    )

    await writeProductionAudit(req, {
      resource: 'ProductionPass',
      resourceId: pass._id,
      action: AUDIT_ACTIONS.PASS_CREATED,
      detail: `Pass ${passNumber} created ${resolvedFrom} → ${toDepartment} for ${batch.batchNumber}`,
      changes: {
        passNumber,
        fromDepartment: resolvedFrom,
        toDepartment,
        weight: w,
        reservedBefore: reserved,
        availableAfter: available - w,
      },
      session,
    })

    return pass
  })

  return { pass: result, reused: false }
}

async function approvePass(req, passId) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const pass = await withSession(ProductionPass.findById(passId), session)
    if (!pass) throw new ProductionError('Pass not found', 404)
    if (pass.status === 'APPROVED' || pass.status === 'ISSUED' || pass.status === 'IN_TRANSIT' || pass.status === 'RECEIVED') {
      return pass
    }
    if (pass.status !== 'REQUESTED') {
      throw new ProductionError(`Cannot approve pass in status ${pass.status}`)
    }

    assertStatusTransition('pass', pass.status, 'APPROVED')
    pass.status = 'APPROVED'
    pass.approvedById = a.id
    pass.approvedByName = a.name
    pass.approvedAt = new Date()
    await pass.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionPass',
      resourceId: pass._id,
      action: AUDIT_ACTIONS.PASS_APPROVED,
      detail: `Pass ${pass.passNumber} approved`,
      changes: { status: 'APPROVED' },
      session,
    })
    return pass
  })
}

async function issuePass(req, passId, { expectedBatchVersion } = {}) {
  const a = actor(req)
  return runInTransaction(async (session) => {
    const pass = await withSession(ProductionPass.findById(passId), session)
    if (!pass) throw new ProductionError('Pass not found', 404)
    if (['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED'].includes(pass.status)) {
      return { pass, movement: pass.movementId ? await withSession(MetalMovement.findById(pass.movementId), session) : null }
    }
    if (!['REQUESTED', 'APPROVED'].includes(pass.status)) {
      throw new ProductionError(`Cannot issue pass in status ${pass.status}`)
    }

    const batch = await withSession(ProductionBatch.findById(pass.batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (batch.status === 'HOLD') throw new ProductionError('Batch is on HOLD')
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    // Re-check reservation at issue time (other passes may have been created)
    const reserved = await sumReservedPassWeight(batch._id, session, { excludePassId: pass._id })
    const available = Number(batch.currentWeight) - reserved
    if (Number(pass.weight) > available + 1e-9) {
      throw new ProductionError(
        `Cannot issue pass: weight ${pass.weight}g exceeds available ${available}g after other open reservations`,
      )
    }

    assertStatusTransition('pass', pass.status, 'IN_TRANSIT')
    if (batch.status !== 'IN_TRANSIT') {
      assertStatusTransition('batch', batch.status, 'IN_TRANSIT')
    }

    const movementNumber = await nextMovementNumber(MetalMovement, session)
    const now = new Date()
    const [movement] = await MetalMovement.create(
      [
        {
          movementNumber,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          passId: pass._id,
          passNumber: pass.passNumber,
          fromDepartment: pass.fromDepartment,
          toDepartment: pass.toDepartment,
          fromPersonId: pass.fromPersonId,
          fromPersonName: pass.fromPersonName,
          toPersonId: pass.toPersonId,
          toPersonName: pass.toPersonName,
          metalType: pass.metalType,
          purity: pass.purity,
          weight: pass.weight,
          purpose: pass.purpose,
          issuedById: a.id,
          issuedByName: a.name,
          issuedAt: now,
          status: 'IN_TRANSIT',
        },
      ],
      writeOpts(session),
    )

    pass.status = 'IN_TRANSIT'
    pass.issuedAt = now
    pass.issuedById = a.id
    pass.issuedByName = a.name
    pass.movementId = movement._id
    await pass.save(writeOpts(session))

    batch.status = 'IN_TRANSIT'
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionPass',
      resourceId: pass._id,
      action: AUDIT_ACTIONS.METAL_TRANSFERRED,
      detail: `Pass ${pass.passNumber} issued; movement ${movementNumber}`,
      changes: {
        fromDepartment: pass.fromDepartment,
        toDepartment: pass.toDepartment,
        weight: pass.weight,
        movementNumber,
      },
      session,
    })

    return { pass, movement }
  })
}

/**
 * Explicit receive — never auto-receive. Idempotent via receiveIdempotencyKey.
 * Validates received weight vs issued; raises variance alert / optional HOLD.
 */
async function receivePass(req, passId, {
  receivedWeight,
  expectedBatchVersion,
  receiveIdempotencyKey = null,
  varianceReason = '',
} = {}) {
  const a = actor(req)

  if (receiveIdempotencyKey) {
    const existing = await ProductionPass.findOne({ receiveIdempotencyKey })
    if (existing) {
      return {
        pass: existing,
        batch: await ProductionBatch.findById(existing.batchId),
        reused: true,
      }
    }
  }

  const result = await runInTransaction(async (session) => {
    const pass = await withSession(ProductionPass.findById(passId), session)
    if (!pass) throw new ProductionError('Pass not found', 404)
    if (pass.status === 'RECEIVED' || pass.status === 'COMPLETED') {
      return {
        pass,
        batch: await withSession(ProductionBatch.findById(pass.batchId), session),
        reused: true,
      }
    }
    if (!['ISSUED', 'IN_TRANSIT'].includes(pass.status)) {
      throw new ProductionError(`Cannot receive pass in status ${pass.status}`)
    }

    const batch = await withSession(ProductionBatch.findById(pass.batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const issuedW = Number(pass.weight)
    const rw = receivedWeight != null ? Number(receivedWeight) : issuedW
    if (!Number.isFinite(rw) || rw < 0 || Number.isNaN(rw)) {
      throw new ProductionError('Invalid received weight')
    }
    if (!Number.isFinite(rw) || !Number.isFinite(issuedW)) {
      throw new ProductionError('Invalid weight values')
    }

    const varianceAbs = Math.abs(rw - issuedW)
    const variancePct = issuedW > 0 ? (varianceAbs / issuedW) * 100 : (rw === issuedW ? 0 : 100)

    const cfg = await getActiveFlowConfig(session)
    const tolerance = Number(cfg.weightTolerancePct || 0)
    const overTolerance = variancePct > tolerance

    if (overTolerance && (!varianceReason || String(varianceReason).trim().length < 3)) {
      throw new ProductionError(
        `Received weight variance ${variancePct.toFixed(2)}% exceeds tolerance ${tolerance}%. A variance reason is required.`,
      )
    }

    assertStatusTransition('pass', pass.status, 'RECEIVED')
    if (batch.status !== 'RECEIVED') {
      assertStatusTransition('batch', batch.status, 'RECEIVED')
    }

    const now = new Date()
    if (pass.movementId) {
      const movement = await withSession(MetalMovement.findById(pass.movementId), session)
      if (movement) {
        movement.status = 'RECEIVED'
        movement.receivedAt = now
        movement.receivedById = a.id
        movement.receivedByName = a.name
        await movement.save(writeOpts(session))
      }
    }

    // Preserve original issued weight on pass.weight permanently.
    pass.status = 'RECEIVED'
    pass.receivedAt = now
    pass.receivedById = a.id
    pass.receivedByName = a.name
    pass.receivedWeight = rw
    pass.varianceAbs = varianceAbs
    pass.variancePct = variancePct
    pass.varianceReason = overTolerance ? String(varianceReason).trim() : (varianceReason || '')
    if (receiveIdempotencyKey) pass.receiveIdempotencyKey = receiveIdempotencyKey
    await pass.save(writeOpts(session))

    const weightBefore = Number(batch.currentWeight)
    batch.currentDepartment = pass.toDepartment
    batch.currentLocation = pass.toDepartment
    batch.currentHolderId = a.id
    batch.currentHolderName = a.name
    batch.currentWeight = rw
    batch.receivedWeight = Number(batch.receivedWeight || 0) + rw
    batch.lastVerifiedWeight = rw
    batch.status = 'RECEIVED'
    if (pass.machineId) {
      batch.currentMachineId = pass.machineId
      batch.currentMachineName = pass.machineName
    }
    batch.version = (batch.version || 0) + 1

    let alert = null
    if (overTolerance) {
      alert = await raiseWeightVarianceAlert(
        req,
        batch,
        { expected: issuedW, actual: rw, variancePct },
        session,
      )
    }

    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProductionPass',
      resourceId: pass._id,
      action: AUDIT_ACTIONS.PASS_RECEIVED,
      detail: `Pass ${pass.passNumber} received by ${a.name} (${rw}g; issued ${issuedW}g)`,
      changes: {
        weightBefore,
        weightAfter: rw,
        issuedWeight: issuedW,
        receivedWeight: rw,
        varianceAbs,
        variancePct,
        varianceReason: pass.varianceReason,
        toDepartment: pass.toDepartment,
        holder: a.name,
      },
      session,
    })

    await writeProductionAudit(req, {
      resource: 'ProductionBatch',
      resourceId: batch._id,
      action: AUDIT_ACTIONS.METAL_RECEIVED,
      detail: `Batch ${batch.batchNumber} received in ${pass.toDepartment}`,
      changes: {
        fromState: 'IN_TRANSIT',
        toState: batch.status,
        weightBefore,
        weightAfter: rw,
      },
      session,
    })

    return { pass, batch, alert, reused: false }
  })

  return result
}

async function cancelPass(req, passId, { reason = '' } = {}) {
  return runInTransaction(async (session) => {
    const pass = await withSession(ProductionPass.findById(passId), session)
    if (!pass) throw new ProductionError('Pass not found', 404)
    if (['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(pass.status)) {
      throw new ProductionError(`Cannot cancel pass in status ${pass.status}`)
    }
    const priorPassStatus = pass.status
    assertStatusTransition('pass', priorPassStatus, 'CANCELLED')
    pass.status = 'CANCELLED'
    await pass.save(writeOpts(session))

    if (pass.movementId) {
      const movement = await withSession(MetalMovement.findById(pass.movementId), session)
      if (movement && movement.status !== 'RECEIVED') {
        movement.status = 'CANCELLED'
        await movement.save(writeOpts(session))
      }
    }

    let batch = null
    if (pass.batchId) {
      batch = await withSession(ProductionBatch.findById(pass.batchId), session)
      if (batch && batch.status === 'IN_TRANSIT') {
        const fromStatus = batch.status
        assertStatusTransition('batch', fromStatus, 'WAITING')
        // Revert custody to the sending department (pre-transit). Reservation freed by CANCELLED status.
        batch.status = 'WAITING'
        batch.currentDepartment = pass.fromDepartment || batch.currentDepartment
        batch.currentLocation = pass.fromDepartment || batch.currentLocation
        batch.version = (batch.version || 0) + 1
        await batch.save(writeOpts(session))

        await writeProductionAudit(req, {
          resource: 'ProductionBatch',
          resourceId: batch._id,
          action: AUDIT_ACTIONS.PASS_CANCELLED,
          detail: `Batch ${batch.batchNumber} reverted to WAITING at ${batch.currentDepartment} after pass cancel`,
          changes: {
            fromState: fromStatus,
            toState: 'WAITING',
            passId: String(pass._id),
            priorPassStatus,
            reason,
          },
          session,
        })
      }
    }

    await writeProductionAudit(req, {
      resource: 'ProductionPass',
      resourceId: pass._id,
      action: AUDIT_ACTIONS.PASS_CANCELLED,
      detail: `Pass ${pass.passNumber} cancelled${reason ? `: ${reason}` : ''}`,
      changes: { reason, priorPassStatus, batchReverted: Boolean(batch && batch.status === 'WAITING') },
      session,
    })
    return { pass, batch }
  })
}

module.exports = {
  createPass,
  approvePass,
  issuePass,
  receivePass,
  cancelPass,
  sumReservedPassWeight,
}

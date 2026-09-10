const ProductionBatch = require('../../models/ProductionBatch')
const ProcessRun = require('../../models/ProcessRun')
const QcInspection = require('../../models/QcInspection')
const WeightAdjustment = require('../../models/WeightAdjustment')
const { runInTransaction, withSession, writeOpts } = require('../../utils/mongoTransaction')
const { writeProductionAudit } = require('./audit')
const { nextProcessNumber, nextInspectionNumber, nextAdjustmentNumber } = require('./numbering')
const { AUDIT_ACTIONS, QC_RESULTS } = require('./constants')
const { ProductionError, raiseWeightVarianceAlert } = require('./batchService')
const { getActiveFlowConfig } = require('./flowConfigService')

function actor(req) {
  return { id: req.user?._id || null, name: req.user?.name || 'system' }
}

async function startProcess(req, input = {}) {
  const {
    batchId,
    process,
    department = '',
    machineId = null,
    machineName = '',
    inputWeight,
    details = {},
    expectedBatchVersion,
  } = input

  if (!batchId || !process) throw new ProductionError('batchId and process are required')
  const a = actor(req)

  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (batch.status === 'HOLD') throw new ProductionError('Batch is on HOLD')
    if (['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(batch.status)) {
      throw new ProductionError(`Cannot start process for batch in status ${batch.status}`)
    }
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const open = await withSession(
      ProcessRun.findOne({ batchId: batch._id, status: 'IN_PROGRESS' }),
      session,
    )
    if (open) throw new ProductionError('Batch already has an in-progress process')

    const iw = inputWeight != null ? Number(inputWeight) : Number(batch.currentWeight)
    if (!Number.isFinite(iw) || iw < 0) throw new ProductionError('Invalid input weight')

    const processNumber = await nextProcessNumber(ProcessRun, session)
    const [run] = await ProcessRun.create(
      [
        {
          processNumber,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          process,
          department: department || batch.currentDepartment,
          machineId,
          machineName,
          operatorId: a.id,
          operatorName: a.name,
          startTime: new Date(),
          inputWeight: iw,
          details: details || {},
          status: 'IN_PROGRESS',
        },
      ],
      writeOpts(session),
    )

    batch.status = 'IN_PROCESS'
    batch.currentProcess = process
    batch.processInputWeight = Number(batch.processInputWeight || 0) + iw
    if (machineId) {
      batch.currentMachineId = machineId
      batch.currentMachineName = machineName
    }
    batch.currentHolderId = a.id
    batch.currentHolderName = a.name
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProcessRun',
      resourceId: run._id,
      action: AUDIT_ACTIONS.PROCESS_STARTED,
      detail: `${process} started on ${batch.batchNumber}`,
      changes: { process, inputWeight: iw, processNumber },
      session,
    })

    return { processRun: run, batch }
  })
}

async function completeProcess(req, processRunId, input = {}) {
  const {
    outputWeight,
    scrap = 0,
    loss = 0,
    sopFollowed = null,
    remarks = '',
    details = {},
    completeIdempotencyKey = null,
    expectedBatchVersion,
  } = input

  if (completeIdempotencyKey) {
    const existing = await ProcessRun.findOne({ completeIdempotencyKey })
    if (existing) {
      return {
        processRun: existing,
        batch: await ProductionBatch.findById(existing.batchId),
        reused: true,
      }
    }
  }

  const a = actor(req)

  return runInTransaction(async (session) => {
    const run = await withSession(ProcessRun.findById(processRunId), session)
    if (!run) throw new ProductionError('Process run not found', 404)
    if (run.status === 'COMPLETED') {
      return {
        processRun: run,
        batch: await withSession(ProductionBatch.findById(run.batchId), session),
        reused: true,
      }
    }
    if (run.status !== 'IN_PROGRESS') {
      throw new ProductionError(`Cannot complete process in status ${run.status}`)
    }

    const ow = Number(outputWeight)
    if (!Number.isFinite(ow) || ow < 0) throw new ProductionError('outputWeight must be a non-negative number')
    const scrapN = Number(scrap) || 0
    const lossN = Number(loss) || 0

    const batch = await withSession(ProductionBatch.findById(run.batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const cfg = await getActiveFlowConfig(session)
    const expected = Number(run.inputWeight) - scrapN - lossN
    const varianceAbs = Math.abs(ow - expected)
    const variancePct = expected > 0 ? (varianceAbs / expected) * 100 : (ow === expected ? 0 : 100)

    run.outputWeight = ow
    run.scrap = scrapN
    run.loss = lossN
    run.sopFollowed = sopFollowed
    run.remarks = remarks || ''
    run.details = { ...(run.details || {}), ...(details || {}) }
    run.endTime = new Date()
    run.status = 'COMPLETED'
    if (completeIdempotencyKey) run.completeIdempotencyKey = completeIdempotencyKey
    await run.save(writeOpts(session))

    const weightBefore = Number(batch.currentWeight)
    batch.currentWeight = ow
    batch.processOutputWeight = Number(batch.processOutputWeight || 0) + ow
    batch.scrapWeight = Number(batch.scrapWeight || 0) + scrapN
    batch.lossWeight = Number(batch.lossWeight || 0) + lossN
    batch.lastVerifiedWeight = ow
    batch.status = 'WAITING'
    batch.version = (batch.version || 0) + 1

    let alert = null
    if (variancePct > Number(cfg.weightTolerancePct || 0)) {
      alert = await raiseWeightVarianceAlert(
        req,
        batch,
        { expected, actual: ow, variancePct },
        session,
      )
    }

    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'ProcessRun',
      resourceId: run._id,
      action: AUDIT_ACTIONS.PROCESS_COMPLETED,
      detail: `${run.process} completed on ${batch.batchNumber} (${run.inputWeight}g → ${ow}g)`,
      changes: {
        weightBefore,
        weightAfter: ow,
        scrap: scrapN,
        loss: lossN,
        variancePct,
        completedBy: a.name,
      },
      session,
    })

    return { processRun: run, batch, alert, reused: false }
  })
}

async function submitQc(req, input = {}) {
  const {
    batchId,
    process = '',
    processRunId = null,
    result,
    weight = null,
    purity = '',
    dimensions = '',
    finish = '',
    stamp = '',
    visualQuality = '',
    sop = null,
    remarks = '',
    reworkReason = '',
    idempotencyKey = null,
    expectedBatchVersion,
  } = input

  if (!batchId || !QC_RESULTS.includes(result)) {
    throw new ProductionError('batchId and valid QC result are required')
  }

  if (idempotencyKey) {
    const existing = await QcInspection.findOne({ idempotencyKey })
    if (existing) {
      return {
        inspection: existing,
        batch: await ProductionBatch.findById(existing.batchId),
        reused: true,
      }
    }
  }

  const a = actor(req)

  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const inspectionNumber = await nextInspectionNumber(QcInspection, session)
    const [inspection] = await QcInspection.create(
      [
        {
          inspectionNumber,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          process,
          processRunId,
          inspectorId: a.id,
          inspectorName: a.name,
          weight: weight != null ? Number(weight) : batch.currentWeight,
          purity: purity || batch.purity,
          dimensions,
          finish,
          stamp,
          visualQuality,
          sop,
          result,
          remarks,
          reworkReason,
          authorizedById: a.id,
          authorizedByName: a.name,
          idempotencyKey: idempotencyKey || null,
        },
      ],
      writeOpts(session),
    )

    const from = batch.status
    let action = AUDIT_ACTIONS.QC_SUBMITTED
    if (result === 'PASS') {
      batch.status = 'QC'
      batch.currentProcess = 'Quality Control'
      action = AUDIT_ACTIONS.QC_PASSED
    } else if (result === 'FAIL') {
      batch.status = 'QC'
      action = AUDIT_ACTIONS.QC_FAILED
    } else if (result === 'HOLD') {
      batch.status = 'HOLD'
      batch.holdReason = remarks || 'QC HOLD'
      action = AUDIT_ACTIONS.BATCH_HOLD
    } else if (result === 'REWORK') {
      batch.status = 'REWORK'
      action = AUDIT_ACTIONS.REWORK_STARTED
    }
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'QcInspection',
      resourceId: inspection._id,
      action,
      detail: `QC ${result} on ${batch.batchNumber}`,
      changes: { fromState: from, toState: batch.status, result, remarks },
      session,
    })

    return { inspection, batch, reused: false }
  })
}

async function adjustWeight(req, batchId, input = {}) {
  const {
    field = 'currentWeight',
    adjustment,
    reason,
    idempotencyKey = null,
    expectedBatchVersion,
  } = input

  if (!reason || String(reason).trim().length < 3) {
    throw new ProductionError('Adjustment reason is required')
  }
  const adj = Number(adjustment)
  if (!Number.isFinite(adj) || adj === 0) {
    throw new ProductionError('adjustment must be a non-zero number')
  }

  if (idempotencyKey) {
    const existing = await WeightAdjustment.findOne({ idempotencyKey })
    if (existing) {
      return {
        adjustment: existing,
        batch: await ProductionBatch.findById(existing.batchId),
        reused: true,
      }
    }
  }

  const allowed = [
    'currentWeight',
    'issuedWeight',
    'receivedWeight',
    'processInputWeight',
    'processOutputWeight',
    'scrapWeight',
    'lossWeight',
    'recoveredWeight',
  ]
  if (!allowed.includes(field)) throw new ProductionError('Invalid weight field')

  const a = actor(req)

  return runInTransaction(async (session) => {
    const batch = await withSession(ProductionBatch.findById(batchId), session)
    if (!batch) throw new ProductionError('Batch not found', 404)
    if (expectedBatchVersion != null && batch.version !== Number(expectedBatchVersion)) {
      throw new ProductionError('Batch was updated by another user. Refresh and retry.', 409)
    }

    const original = Number(batch[field] || 0)
    const next = original + adj
    if (next < 0) throw new ProductionError('Adjusted weight cannot be negative')

    const adjustmentNumber = await nextAdjustmentNumber(WeightAdjustment, session)
    const [row] = await WeightAdjustment.create(
      [
        {
          adjustmentNumber,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          field,
          originalValue: original,
          adjustment: adj,
          newValue: next,
          reason: String(reason).trim(),
          approvedById: a.id,
          approvedByName: a.name,
          createdById: a.id,
          createdByName: a.name,
          idempotencyKey: idempotencyKey || null,
        },
      ],
      writeOpts(session),
    )

    batch[field] = next
    if (field === 'currentWeight') batch.lastVerifiedWeight = next
    batch.version = (batch.version || 0) + 1
    await batch.save(writeOpts(session))

    await writeProductionAudit(req, {
      resource: 'WeightAdjustment',
      resourceId: row._id,
      action: AUDIT_ACTIONS.WEIGHT_ADJUSTED,
      detail: `Weight ${field} adjusted on ${batch.batchNumber}: ${original} → ${next} (${adj})`,
      changes: { field, originalValue: original, adjustment: adj, newValue: next, reason },
      session,
    })

    return { adjustment: row, batch, reused: false }
  })
}

module.exports = {
  startProcess,
  completeProcess,
  submitQc,
  adjustWeight,
}

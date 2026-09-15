const ProductionBatch = require('../../models/ProductionBatch')
const ProcessRun = require('../../models/ProcessRun')
const ProductionMachine = require('../../models/ProductionMachine')
const ProductionAlert = require('../../models/ProductionAlert')
const { ACTIVE_BATCH_STATUSES, DEFAULT_FLOW_STAGES } = require('./constants')
const { getActiveFlowConfig } = require('./flowConfigService')
const { ProductionError } = require('./batchService')

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function resolveStage(flow, departmentKey) {
  const stages = flow?.stages?.length ? flow.stages : DEFAULT_FLOW_STAGES
  const key = String(departmentKey || '').trim().toLowerCase()
  const stage = stages.find((s) => String(s.key).toLowerCase() === key
    || String(s.process || '').toLowerCase() === key
    || String(s.label || '').toLowerCase() === key)
  if (!stage) throw new ProductionError(`Unknown department: ${departmentKey}`, 404)
  return stage
}

async function getDepartmentDashboard(departmentKey) {
  const flow = await getActiveFlowConfig()
  const stage = resolveStage(flow, departmentKey)
  const today = startOfToday()
  const deptKey = stage.key
  const processName = stage.process || stage.label

  const deptMatch = {
    $or: [
      { currentDepartment: deptKey },
      { currentDepartment: new RegExp(`^${deptKey}$`, 'i') },
      { currentProcess: processName },
    ],
  }

  const [
    waitingJobs,
    _activeJobsCount,
    completedToday,
    holdJobs,
    activeRuns,
    completedRunsToday,
    machines,
    alerts,
    weightAgg,
    recentRuns,
  ] = await Promise.all([
    ProductionBatch.countDocuments({
      ...deptMatch,
      status: { $in: ['WAITING', 'RECEIVED', 'ISSUED'] },
    }),
    ProductionBatch.countDocuments({
      ...deptMatch,
      status: 'IN_PROCESS',
    }),
    ProcessRun.countDocuments({
      $or: [{ department: deptKey }, { process: processName }],
      status: 'COMPLETED',
      endTime: { $gte: today },
    }),
    ProductionBatch.countDocuments({
      ...deptMatch,
      status: 'HOLD',
    }),
    ProcessRun.find({
      $or: [{ department: deptKey }, { process: processName }],
      status: 'IN_PROGRESS',
    }).sort({ startTime: -1 }).limit(100).lean(),
    ProcessRun.find({
      $or: [{ department: deptKey }, { process: processName }],
      status: 'COMPLETED',
      endTime: { $gte: today },
    }).sort({ endTime: -1 }).limit(50).lean(),
    ProductionMachine.find({
      isActive: true,
      $or: [
        { department: deptKey },
        { process: processName },
        { department: stage.label },
      ],
    }).lean(),
    ProductionAlert.find({
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      $or: [
        { 'metadata.department': deptKey },
        { message: new RegExp(stage.label, 'i') },
      ],
    }).sort({ createdAt: -1 }).limit(20).lean(),
    ProcessRun.aggregate([
      {
        $match: {
          $or: [{ department: deptKey }, { process: processName }],
          status: { $in: ['IN_PROGRESS', 'COMPLETED'] },
          createdAt: { $gte: today },
        },
      },
      {
        $group: {
          _id: null,
          inputWeight: { $sum: '$inputWeight' },
          outputWeight: { $sum: { $ifNull: ['$outputWeight', 0] } },
          scrap: { $sum: '$scrap' },
          loss: { $sum: '$loss' },
          recovery: { $sum: { $ifNull: ['$details.recovery', 0] } },
        },
      },
    ]),
    ProcessRun.find({
      $or: [{ department: deptKey }, { process: processName }],
    }).sort({ updatedAt: -1 }).limit(80).lean(),
  ])

  const waitingBatches = await ProductionBatch.find({
    ...deptMatch,
    status: { $in: ACTIVE_BATCH_STATUSES },
  }).sort({ updatedAt: -1 }).limit(80).lean()

  const batchIds = [
    ...new Set([
      ...activeRuns.map((r) => String(r.batchId)),
      ...waitingBatches.map((b) => String(b._id)),
      ...recentRuns.map((r) => String(r.batchId)),
    ]),
  ]
  const batches = await ProductionBatch.find({ _id: { $in: batchIds } }).lean()
  const batchMap = Object.fromEntries(batches.map((b) => [String(b._id), b]))

  const jobs = recentRuns.map((run) => {
    const batch = batchMap[String(run.batchId)] || {}
    return {
      processRunId: run._id,
      processNumber: run.processNumber,
      batchId: run.batchId,
      batchCode: run.batchNumber || batch.batchNumber,
      stockCode: batch.stockCode || '',
      product: batch.product || '',
      quantity: batch.targetQuantity || 0,
      inputWeight: run.inputWeight,
      outputWeight: run.outputWeight,
      scrap: run.scrap,
      loss: run.loss,
      recovery: run.details?.recovery ?? null,
      operator: run.operatorName,
      machine: run.machineName,
      startTime: run.startTime,
      endTime: run.endTime,
      status: run.status,
      process: run.process,
      department: run.department,
      details: run.details || {},
      remarks: run.remarks || '',
      batchStatus: batch.status,
    }
  })

  const runningCount = activeRuns.length
  const waitingCount = waitingJobs
  let departmentStatus = 'IDLE'
  if (holdJobs > 0 && runningCount === 0) departmentStatus = 'HOLD'
  else if (runningCount > 0) departmentStatus = 'RUNNING'
  else if (waitingCount > 0) departmentStatus = 'WAITING'
  else if (completedToday > 0 && runningCount === 0) departmentStatus = 'COMPLETED'

  const thresholds = flow.alertThresholds || {}
  const overload = Number(thresholds.departmentOverloadJobs || 20)
  if (waitingCount + runningCount >= overload) departmentStatus = 'DELAYED'

  const operators = [...new Set(activeRuns.map((r) => r.operatorName).filter(Boolean))]
  const weights = weightAgg[0] || { inputWeight: 0, outputWeight: 0, scrap: 0, loss: 0, recovery: 0 }

  const qcPending = deptKey === 'quality_control'
    ? await ProductionBatch.countDocuments({ status: 'QC' })
    : await ProductionBatch.countDocuments({ ...deptMatch, status: 'QC' })

  return {
    department: {
      key: stage.key,
      label: stage.label,
      process: stage.process,
      order: stage.order,
      status: departmentStatus,
    },
    kpis: {
      waitingJobs: waitingCount,
      activeJobs: runningCount,
      completedToday,
      pendingJobs: waitingCount,
      holdJobs,
      totalInputWeight: weights.inputWeight,
      totalOutputWeight: weights.outputWeight,
      scrap: weights.scrap,
      loss: weights.loss,
      recovery: weights.recovery,
      operators: operators.length,
      machines: machines.length,
      qcPending,
      alerts: alerts.length,
    },
    operators,
    machines,
    alerts,
    jobs,
    activeRuns,
    completedRunsToday,
    waitingBatches,
  }
}

async function listDepartmentStatuses() {
  const flow = await getActiveFlowConfig()
  const stages = (flow.stages || DEFAULT_FLOW_STAGES).filter((s) => s.process)
  const results = []
  for (const stage of stages) {
    const dash = await getDepartmentDashboard(stage.key)
    results.push({
      key: stage.key,
      label: stage.label,
      status: dash.department.status,
      waiting: dash.kpis.waitingJobs,
      active: dash.kpis.activeJobs,
      completedToday: dash.kpis.completedToday,
    })
  }
  return results
}

module.exports = {
  getDepartmentDashboard,
  listDepartmentStatuses,
  resolveStage,
}

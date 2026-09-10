function pad(n, width = 4) {
  return String(n).padStart(width, '0')
}

function dayStamp(date = new Date()) {
  const y = date.getFullYear().toString().slice(-2)
  const m = pad(date.getMonth() + 1, 2)
  const d = pad(date.getDate(), 2)
  return `${y}${m}${d}`
}

function metalPrefix(metalType) {
  const map = { Gold: 'MG', Silver: 'MS', Platinum: 'MP', Other: 'MX' }
  return map[metalType] || 'MX'
}

async function nextSeq(Model, field, prefix, session) {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  const query = Model.findOne({ [field]: re }).sort({ [field]: -1 }).select(field).lean()
  if (session) query.session(session)
  const last = await query
  if (!last?.[field]) return 1
  const parts = String(last[field]).split('-')
  const n = parseInt(parts[parts.length - 1], 10)
  return Number.isFinite(n) ? n + 1 : 1
}

async function nextBatchNumber(ProductionBatch, metalType, session) {
  const prefix = `${metalPrefix(metalType)}-${dayStamp()}`
  const seq = await nextSeq(ProductionBatch, 'batchNumber', `${prefix}-`, session)
  return `${prefix}-${pad(seq)}`
}

async function nextPassNumber(ProductionPass, session) {
  // Use full year for passes per prompt style MP-20260910-0042
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `MP-${full}`
  const seq = await nextSeq(ProductionPass, 'passNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

async function nextMovementNumber(MetalMovement, session) {
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `MM-${full}`
  const seq = await nextSeq(MetalMovement, 'movementNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

async function nextProcessNumber(ProcessRun, session) {
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `PR-${full}`
  const seq = await nextSeq(ProcessRun, 'processNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

async function nextInspectionNumber(QcInspection, session) {
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `QC-${full}`
  const seq = await nextSeq(QcInspection, 'inspectionNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

async function nextAdjustmentNumber(WeightAdjustment, session) {
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `WA-${full}`
  const seq = await nextSeq(WeightAdjustment, 'adjustmentNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

async function nextAlertNumber(ProductionAlert, session) {
  const ymd = new Date()
  const full = `${ymd.getFullYear()}${pad(ymd.getMonth() + 1, 2)}${pad(ymd.getDate(), 2)}`
  const p = `AL-${full}`
  const seq = await nextSeq(ProductionAlert, 'alertNumber', `${p}-`, session)
  return `${p}-${pad(seq)}`
}

module.exports = {
  nextBatchNumber,
  nextPassNumber,
  nextMovementNumber,
  nextProcessNumber,
  nextInspectionNumber,
  nextAdjustmentNumber,
  nextAlertNumber,
}

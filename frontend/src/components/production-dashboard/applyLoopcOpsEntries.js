import { DASHBOARD_DEPARTMENTS } from './departmentConfig'

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Same formula as Operations sheet Time / Batch (productionSheetUtils.entryDurationMinutes).
 * Returns unrounded minutes; caller rounds for display/avg as needed.
 */
function opsTimeBatchMinutes(entry) {
  const start = entry?.batchStartedAt ? new Date(entry.batchStartedAt) : null
  if (!start || !Number.isFinite(start.getTime())) return null
  const end = entry?.batchOverAt ? new Date(entry.batchOverAt) : new Date()
  if (!Number.isFinite(end.getTime())) return null
  const mins = (end.getTime() - start.getTime()) / 60000
  return mins >= 0 ? mins : null
}

function entryStatus(entry) {
  if (entry?.batchOverAt) return 'Completed'
  if (entry?.batchStartedAt) return 'Running'
  return 'Idle'
}

function metalLossOf(entry) {
  const explicit = numOrNull(entry?.metalLoss)
  if (explicit != null) return Math.max(0, explicit)
  const inn = numOrNull(entry?.metalIn)
  const out = numOrNull(entry?.metalOut)
  if (inn != null && out != null) return Math.max(0, inn - out)
  return null
}

/**
 * Build Production Dashboard dept cards + KPI overlays from LoopC Operations entries (today).
 */
export function buildLoopcOpsDashboardOverlay(entries = []) {
  const list = Array.isArray(entries) ? entries : []

  const byDept = new Map()
  DASHBOARD_DEPARTMENTS.forEach((d) => byDept.set(d.key, []))
  list.forEach((e) => {
    const key = String(e?.departmentKey || '').trim()
    if (!byDept.has(key)) return
    byDept.get(key).push(e)
  })

  const deptCards = DASHBOARD_DEPARTMENTS.map((dept) => {
    const rows = byDept.get(dept.key) || []
    const hasData = rows.length > 0

    let metalIn = 0
    let metalOut = 0
    let metalLossSum = 0
    let hasIn = false
    let hasOut = false
    let hasLoss = false
    const lossRows = []
    const employees = []
    const nameSet = new Set()
    let manager = null
    let startedAt = null
    let completedAt = null
    let primary = null
    let status = 'Idle'

    rows.forEach((e, i) => {
      const inn = numOrNull(e.metalIn)
      const out = numOrNull(e.metalOut)
      const loss = metalLossOf(e)
      if (inn != null) { metalIn += inn; hasIn = true }
      if (out != null) { metalOut += out; hasOut = true }
      if (loss != null) {
        metalLossSum += loss
        hasLoss = true
        lossRows.push({ index: i + 1, label: e.batchNumber ? String(e.batchNumber) : `Batch ${i + 1}`, loss })
      }
      const emp = String(e.employeeName || '').trim()
      if (emp) {
        nameSet.add(emp)
        employees.push({ name: emp })
      }
      const mgr = String(e.departmentManagerName || '').trim()
      if (mgr && !manager) manager = mgr
      if (e.batchStartedAt) {
        const t = new Date(e.batchStartedAt)
        if (Number.isFinite(t.getTime()) && (!startedAt || t < new Date(startedAt))) {
          startedAt = e.batchStartedAt
        }
        // Primary = latest started batch (Time / Batch)
        if (!primary || t > new Date(primary.batchStartedAt || 0)) {
          primary = e
        }
      }
      if (e.batchOverAt) {
        const t = new Date(e.batchOverAt)
        if (Number.isFinite(t.getTime()) && (!completedAt || t > new Date(completedAt))) {
          completedAt = e.batchOverAt
        }
      }
      const st = entryStatus(e)
      if (st === 'Running') status = 'Running'
      else if (st === 'Completed' && status !== 'Running') status = 'Completed'
      else if (status === 'Idle' && st === 'Idle') status = 'Idle'
      if (!primary) primary = e
    })

    const times = rows
      .map((e) => opsTimeBatchMinutes(e))
      .filter((n) => n != null && Number.isFinite(n))
    // Avg. Time = sum(Ops Time/Batch) / n
    const avgTimeMin = times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null
    const primaryRaw = opsTimeBatchMinutes(primary)
    const primaryElapsed = primaryRaw != null
      ? Math.round(primaryRaw)
      : (times.length ? Math.round(times[times.length - 1]) : null)

    const metalInVal = hasIn ? metalIn : null
    const metalOutVal = hasOut ? metalOut : null
    const metalLossVal = hasLoss ? metalLossSum : null
    const metalBalance = metalInVal != null && metalOutVal != null
      ? Math.max(0, metalInVal - metalOutVal)
      : metalInVal

    return {
      key: dept.key,
      name: dept.label,
      subtitle: dept.subtitle || '',
      status: hasData ? status : 'Idle',
      batchId: primary?._id || primary?.id || null,
      batchNumber: primary?.batchNumber || null,
      employeeName: primary?.employeeName || (employees[0]?.name || null),
      employeeCode: null,
      employeeCount: nameSet.size || null,
      employees,
      floorManager: manager,
      shiftName: null,
      startedAt,
      completedAt,
      elapsedMin: primaryElapsed,
      avgTimeMin: avgTimeMin ?? primaryElapsed,
      metalIn: metalInVal,
      metalOut: metalOutVal,
      metalBalance,
      metalLoss: metalLossVal,
      lossRows,
      lossPct: metalInVal && metalLossVal != null && metalInVal > 0
        ? Math.round((metalLossVal / metalInVal) * 1000) / 10
        : null,
      confirmState: null,
      passId: null,
      passStatus: null,
      progress: { mode: 'determinate', percent: status === 'Completed' ? 100 : (status === 'Running' ? 50 : 0) },
      quantity: metalOutVal ?? metalInVal,
      timeTakenMin: primaryElapsed,
      hasData,
      isMelting: dept.key === 'melting',
      isAssembly: dept.key === 'assembly',
      tableCount: dept.tableCount || null,
      activeBatchCount: rows.length,
      flowStatus: status === 'Running' ? 'ACTIVE' : (status === 'Idle' ? 'STABLE' : String(status || 'STABLE').toUpperCase()),
    }
  })

  const batchMonitorRows = list.map((e) => {
    const inn = numOrNull(e.metalIn)
    const out = numOrNull(e.metalOut)
    const loss = metalLossOf(e)
    const status = entryStatus(e)
    const durationRaw = opsTimeBatchMinutes(e)
    return {
      id: e._id || e.id,
      batchNumber: e.batchNumber || '—',
      department: e.departmentKey,
      departmentKey: e.departmentKey,
      status,
      employee: e.employeeName || null,
      qtyIn: inn,
      qtyOut: out,
      metalLoss: loss,
      durationMin: durationRaw != null ? Math.round(durationRaw) : null,
      startedAt: e.batchStartedAt || null,
      completedAt: e.batchOverAt || null,
    }
  })

  let totalIn = 0
  let totalOut = 0
  let totalLoss = 0
  let hasAny = false
  list.forEach((e) => {
    const inn = numOrNull(e.metalIn)
    const out = numOrNull(e.metalOut)
    const loss = metalLossOf(e)
    if (inn != null) { totalIn += inn; hasAny = true }
    if (out != null) { totalOut += out; hasAny = true }
    if (loss != null) totalLoss += loss
  })

  const empSet = new Set()
  list.forEach((e) => {
    const n = String(e.employeeName || '').trim()
    if (n) empSet.add(n)
  })
  const managers = list.map((e) => String(e.departmentManagerName || '').trim()).filter(Boolean)
  const floorManager = managers[0] || null
  const running = list.filter((e) => entryStatus(e) === 'Running').length
  const completed = list.filter((e) => entryStatus(e) === 'Completed').length

  return {
    hasOpsData: hasAny || list.length > 0,
    deptCards,
    batchMonitorRows,
    kpis: {
      totalProductionToday: hasAny ? (totalIn || totalOut) : null,
      underProduction: running > 0 ? totalIn - totalOut : null,
      totalOutput: hasAny ? totalOut : null,
      employees: empSet.size || null,
      floorManager,
      activeBatches: running,
      totalBatches: list.length || null,
      completedBatches: completed,
      metalIn: hasAny ? totalIn : null,
      metalOut: hasAny ? totalOut : null,
      metalLoss: hasAny ? totalLoss : null,
    },
  }
}

/**
 * Merge LoopC Operations overlay onto an existing dashboard model.
 * Replaces idle/empty dept cards and KPI totals when ops entries exist for today.
 */
export function applyLoopcOpsEntriesToModel(model, entries) {
  if (!model) return model
  const overlay = buildLoopcOpsDashboardOverlay(entries)
  if (!overlay.hasOpsData) {
    return {
      ...model,
      deptCards: overlay.deptCards,
      liveDeptCards: overlay.deptCards,
      batchMonitorRows: [],
      hasLiveProduction: false,
      sourceOfTruth: 'operations-entries',
    }
  }

  const k = overlay.kpis
  return {
    ...model,
    hasLiveProduction: true,
    sourceOfTruth: 'operations-entries',
    deptCards: overlay.deptCards,
    liveDeptCards: overlay.deptCards,
    batchMonitorRows: overlay.batchMonitorRows,
    header: {
      ...(model.header || {}),
      status: k.activeBatches > 0
        ? 'Factory Online — Operations ledger active'
        : 'Operations ledger — today',
      floorManager: k.floorManager ?? model.header?.floorManager ?? null,
      employeeCount: k.employees ?? model.header?.employeeCount ?? null,
      activeBatches: k.activeBatches,
      totalBatches: k.totalBatches,
    },
    compactKpis: {
      ...(model.compactKpis || {}),
      employees: k.employees,
      floorManager: k.floorManager,
      totalProductionToday: k.totalProductionToday,
      underProduction: k.underProduction,
      totalOutput: k.totalOutput,
    },
    employeeKpi: {
      ...(model.employeeKpi || {}),
      total: k.employees,
      active: k.employees,
      floorManager: k.floorManager,
    },
    productionTodayKpi: {
      ...(model.productionTodayKpi || {}),
      processedQty: k.metalIn,
      productionWeight: k.metalOut,
      completedBatches: k.completedBatches,
      totalBatches: k.totalBatches,
    },
    outputKpi: {
      ...(model.outputKpi || {}),
      inputWeight: k.metalIn,
      outputWeight: k.metalOut,
      outputQuantity: k.metalOut,
    },
    statusSummary: {
      running: k.activeBatches,
      idle: Math.max(0, (overlay.deptCards || []).filter((c) => c.status === 'Idle').length),
      completed: k.completedBatches,
    },
  }
}


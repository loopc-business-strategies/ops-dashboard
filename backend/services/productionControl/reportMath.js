/**
 * Pure helpers for report golden comparisons (no DB).
 * Keeps department performance math stable across query rewrites.
 */

function departmentRowsFromRuns(stages, allRuns) {
  return stages.map((stage) => {
    const runs = allRuns.filter(
      (r) => r.department === stage.key || r.process === stage.process,
    )
    const completed = runs.filter((r) => r.status === 'COMPLETED' && r.startTime && r.endTime)
    const durations = completed.map((r) => (new Date(r.endTime) - new Date(r.startTime)) / 60000)
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    return {
      department: stage.label,
      key: stage.key,
      jobs: runs.length,
      completed: completed.length,
      pending: runs.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'PENDING').length,
      weight: completed.reduce((s, r) => s + Number(r.outputWeight || 0), 0),
      scrap: completed.reduce((s, r) => s + Number(r.scrap || 0), 0),
      loss: completed.reduce((s, r) => s + Number(r.loss || 0), 0),
      averageProcessingMinutes: Math.round(avg * 10) / 10,
    }
  })
}

function dailySummaryFromRuns(runs) {
  const completed = runs.filter((r) => r.status === 'COMPLETED')
  const pending = runs.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
  const byDept = {}
  for (const r of runs) {
    const key = r.department || r.process || 'unknown'
    if (!byDept[key]) {
      byDept[key] = {
        department: key,
        jobs: 0,
        completed: 0,
        pending: 0,
        weightIn: 0,
        weightOut: 0,
        scrap: 0,
        loss: 0,
      }
    }
    byDept[key].jobs += 1
    if (r.status === 'COMPLETED') byDept[key].completed += 1
    else byDept[key].pending += 1
    byDept[key].weightIn += Number(r.inputWeight || 0)
    byDept[key].weightOut += Number(r.outputWeight || 0)
    byDept[key].scrap += Number(r.scrap || 0)
    byDept[key].loss += Number(r.loss || 0)
  }
  return {
    summary: {
      jobs: runs.length,
      completed: completed.length,
      pending: pending.length,
      weightIn: completed.reduce((s, r) => s + Number(r.inputWeight || 0), 0),
      weightOut: completed.reduce((s, r) => s + Number(r.outputWeight || 0), 0),
      scrap: completed.reduce((s, r) => s + Number(r.scrap || 0), 0),
      loss: completed.reduce((s, r) => s + Number(r.loss || 0), 0),
    },
    byDepartment: Object.values(byDept),
  }
}

module.exports = {
  departmentRowsFromRuns,
  dailySummaryFromRuns,
}

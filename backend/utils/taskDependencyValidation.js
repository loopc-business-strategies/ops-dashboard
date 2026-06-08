// DFS from startIds following dependsOn; true if targetTaskId is reachable (would create a cycle for that task).
async function dependsOnReachesTask(TaskModel, startIds, targetTaskId) {
  if (!targetTaskId || !Array.isArray(startIds) || !startIds.length) return false
  const target = String(targetTaskId)
  const stack = startIds.map((id) => String(id)).filter(Boolean)
  const seen = new Set()

  while (stack.length) {
    const sid = stack.pop()
    if (!sid || seen.has(sid)) continue
    seen.add(sid)
    if (sid === target) return true

    const doc = await TaskModel.findById(sid).select('dependsOn').lean()
    const deps = doc?.dependsOn || []
    for (const d of deps) {
      const ds = String(d)
      if (!seen.has(ds)) stack.push(ds)
    }
  }
  return false
}

module.exports = { dependsOnReachesTask }

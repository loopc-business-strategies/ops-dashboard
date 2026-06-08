const mongoose = require('mongoose')
const { normalize } = require('../services/permissions/moduleAccessPolicy')

function extendedFieldsFromBody(body = {}) {
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 20).map((t) => t.slice(0, 40))
    : []
  const checklist = Array.isArray(body.checklist)
    ? body.checklist
        .filter((c) => c && String(c.title || '').trim())
        .slice(0, 40)
        .map((c, i) => ({
          title: String(c.title).trim().slice(0, 200),
          done: Boolean(c.done),
          order: typeof c.order === 'number' && !Number.isNaN(c.order) ? c.order : i,
        }))
    : []
  const blockedReason = body.blockedReason != null ? String(body.blockedReason).trim().slice(0, 500) : ''
  const blockedByTaskId =
    body.blockedByTaskId && mongoose.Types.ObjectId.isValid(body.blockedByTaskId)
      ? new mongoose.Types.ObjectId(body.blockedByTaskId)
      : null
  const dependsOn = Array.isArray(body.dependsOn)
    ? [...new Set(body.dependsOn.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)))]
    : []
  const estimateHours =
    body.estimateHours === null || body.estimateHours === undefined || body.estimateHours === ''
      ? null
      : Number(body.estimateHours)
  const loggedHours =
    body.loggedHours === null || body.loggedHours === undefined || body.loggedHours === ''
      ? null
      : Number(body.loggedHours)
  return {
    tags,
    checklist,
    blockedReason,
    blockedByTaskId,
    dependsOn,
    estimateHours: estimateHours !== null && Number.isNaN(estimateHours) ? null : estimateHours,
    loggedHours: loggedHours !== null && Number.isNaN(loggedHours) ? null : loggedHours,
  }
}

function parseAlsoNotifyForDb(body = {}) {
  const rawIds = Array.isArray(body.alsoNotifyIds) ? body.alsoNotifyIds : []
  const ids = [...new Set(rawIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id)))].slice(0, 50)
  const rawNames = Array.isArray(body.alsoNotifyNames) ? body.alsoNotifyNames : []
  const names = [...new Set(rawNames.map((n) => String(n).trim()).filter(Boolean))].slice(0, 50).map((n) => n.slice(0, 120))
  return { alsoNotifyIds: ids, alsoNotifyNames: names }
}

async function assertRelatedTasksSameDepartment(TaskModel, department, { blockedByTaskId, dependsOn }) {
  const dept = normalize(department || '')
  const ids = []
  if (blockedByTaskId) ids.push(String(blockedByTaskId))
  if (Array.isArray(dependsOn)) ids.push(...dependsOn.map((x) => String(x)))
  const unique = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id))
  for (const sid of unique) {
    const other = await TaskModel.findById(sid).select('department isDeleted').lean()
    if (!other || other.isDeleted) {
      return `Related task not found (${sid}).`
    }
    if (normalize(other.department || '') !== dept) {
      return 'Related tasks must belong to the same department as this task.'
    }
  }
  return null
}

module.exports = {
  extendedFieldsFromBody,
  parseAlsoNotifyForDb,
  assertRelatedTasksSameDepartment,
}

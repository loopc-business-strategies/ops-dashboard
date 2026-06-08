/**
 * Server-side task automation helpers (status → scheduled archive, due-change resets).
 * Kept pure for unit tests.
 */

const DEFAULT_AUTO_ARCHIVE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * @param {object} dbPatch - fields going to Mongo (already coerced); may include `status`, `dueDate`, etc.
 * @param {object} task - current task document before update
 * @param {{ now?: number, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {object} patched copy of dbPatch with `autoArchiveAt` / `dueProximityNotifiedForDue` adjustments
 */
function applyAutomationDerivedFields(dbPatch, task, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now()
  const env = opts.env || process.env
  const out = { ...dbPatch }
  const prevSt = String(task.status || '').toLowerCase()
  const nextSt = out.status !== undefined ? String(out.status).toLowerCase() : prevSt

  if (out.status !== undefined) {
    const transitionToDone =
      (nextSt === 'done' || nextSt === 'cancelled') && prevSt !== 'done' && prevSt !== 'cancelled'
    const transitionFromDone =
      (prevSt === 'done' || prevSt === 'cancelled') && nextSt !== 'done' && nextSt !== 'cancelled'

    if (transitionToDone) {
      const delayMs = Math.max(60_000, Number(env.TASK_RULE_AUTO_ARCHIVE_MS) || DEFAULT_AUTO_ARCHIVE_MS)
      out.autoArchiveAt = new Date(now + delayMs)
    } else if (transitionFromDone) {
      out.autoArchiveAt = null
    }
  }

  if (out.dueDate !== undefined) {
    const oldT = task.dueDate ? new Date(task.dueDate).getTime() : null
    const newT = out.dueDate ? new Date(out.dueDate).getTime() : null
    if (oldT !== newT) {
      out.dueProximityNotifiedForDue = null
    }
  }

  return out
}

module.exports = { applyAutomationDerivedFields, DEFAULT_AUTO_ARCHIVE_MS }

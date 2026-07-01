const SalesAiAgentTask = require('../../models/SalesAiAgentTask')
const { AGENT_TYPES } = require('../../models/SalesAiAgentTask')
const { runSalesAiChat } = require('./salesAiOrchestrator')

async function listTasks(user, { status, limit = 30 } = {}) {
  const filter = { isDeleted: false }
  if (status) filter.status = status
  if (user.role !== 'super_admin' && user.role !== 'management') {
    filter.$or = [
      { createdBy: user._id },
      { assignedToId: user._id },
    ]
  }
  return SalesAiAgentTask.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean()
}

async function createTask(user, { agent, prompt, assignedTo, assignedToId, pageContext }) {
  if (!AGENT_TYPES.includes(agent)) {
    const err = new Error(`Invalid agent. Allowed: ${AGENT_TYPES.join(', ')}`)
    err.statusCode = 400
    throw err
  }
  const doc = await SalesAiAgentTask.create({
    agent,
    prompt: String(prompt || '').trim(),
    assignedTo: assignedTo || user.name,
    assignedToId: assignedToId || user._id,
    createdBy: user._id,
    createdByName: user.name,
    pageContext: pageContext || {},
    status: 'queued',
  })
  return doc.toObject()
}

async function runTask(user, taskId) {
  const task = await SalesAiAgentTask.findOne({ _id: taskId, isDeleted: false })
  if (!task) {
    const err = new Error('Task not found.')
    err.statusCode = 404
    throw err
  }
  if (user.role !== 'super_admin' && user.role !== 'management') {
    const owns = String(task.createdBy) === String(user._id)
      || String(task.assignedToId) === String(user._id)
    if (!owns) {
      const err = new Error('Not allowed to run this task.')
      err.statusCode = 403
      throw err
    }
  }

  task.status = 'running'
  await task.save()

  try {
    const scopedPrompt = `[Agent: ${task.agent}] ${task.prompt}`
    const result = await runSalesAiChat({
      user,
      message: scopedPrompt,
      pageContext: task.pageContext || {},
    })
    task.status = 'done'
    task.result = result.reply
    task.error = ''
    await task.save()
    return { task: task.toObject(), result }
  } catch (err) {
    task.status = 'failed'
    task.error = err.message || 'Task failed'
    await task.save()
    throw err
  }
}

module.exports = {
  AGENT_TYPES,
  listTasks,
  createTask,
  runTask,
}

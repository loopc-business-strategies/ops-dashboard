const SalesAiActionProposal = require('../../../models/SalesAiActionProposal')
const { logAutomation } = require('./autoExecutor')

const PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function upsertProposals(tenant, tier2Actions = [], options = {}) {
  const created = []
  for (const action of tier2Actions) {
    const existing = await SalesAiActionProposal.findOne({
      tenant,
      status: 'pending',
      actionType: action.actionType,
      title: action.title,
    }).lean()
    if (existing) {
      created.push(existing)
      continue
    }

    const doc = await SalesAiActionProposal.create({
      tenant,
      actionType: action.actionType,
      status: 'pending',
      title: action.title,
      summary: action.summary || action.detail || '',
      payload: action.payload || {},
      expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS),
    })

    await logAutomation({
      tenant,
      actionType: action.actionType,
      tier: 'approve',
      status: 'pending',
      title: action.title,
      detail: action.summary || '',
      source: options.source || 'proactive',
      dedupeKey: action.dedupeKey ? `proposal:${action.dedupeKey}` : '',
      meta: { proposalId: String(doc._id) },
    }).catch(() => {})

    created.push(doc)
  }
  return created
}

async function listPendingProposals(tenant, limit = 20) {
  const now = new Date()
  await SalesAiActionProposal.updateMany(
    { tenant, status: 'pending', expiresAt: { $lt: now } },
    { $set: { status: 'expired' } },
  )
  return SalesAiActionProposal.find({ tenant, status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
}

async function resolveProposal(tenant, proposalId, userId, resolution) {
  const status = resolution === 'approve' ? 'approved' : 'dismissed'
  const doc = await SalesAiActionProposal.findOneAndUpdate(
    { _id: proposalId, tenant, status: 'pending' },
    { $set: { status, resolvedBy: userId, resolvedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!doc) return null

  await logAutomation({
    tenant,
    actionType: doc.actionType,
    tier: 'approve',
    status: status === 'approved' ? 'completed' : 'skipped',
    title: doc.title,
    detail: `User ${status} proposal`,
    source: 'user',
    meta: { proposalId: String(doc._id), resolution: status },
  }).catch(() => {})

  return doc
}

function buildMailtoUrl(proposal) {
  const p = proposal.payload || {}
  const to = String(p.to || '').replace(/.*<([^>]+)>.*/, '$1').trim()
  const subject = encodeURIComponent(p.subject || proposal.title || '')
  const body = encodeURIComponent(p.body || '')
  return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
}

module.exports = {
  upsertProposals,
  listPendingProposals,
  resolveProposal,
  buildMailtoUrl,
}

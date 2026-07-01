const User = require('../models/User')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')
const { isSalesAiEnabledForTenant } = require('../services/salesAi/salesAiAccess')
const { isOpenAiConfigured } = require('../services/salesAi/openAiClient')
const { runSalesAiChat } = require('../services/salesAi/salesAiOrchestrator')
const { notifyUsers } = require('../services/notificationDispatch')

const INTERVAL_MS = Number(process.env.SALES_AI_DIGEST_INTERVAL_MS || 24 * 60 * 60 * 1000)

async function runDigestForTenant(tenantKey) {
  if (!isSalesAiEnabledForTenant(tenantKey)) return
  if (!isOpenAiConfigured() && process.env.SALES_AI_SYNTHESIS_MODE === 'openai') return

  const recipients = await User.find({
    company: tenantKey,
    role: { $in: ['super_admin', 'management'] },
    isActive: { $ne: false },
  }).select('_id name').lean()

  if (!recipients.length) return

  const prompt = process.env.SALES_AI_DIGEST_PROMPT
    || 'Prepare a daily sales briefing: market signals, pipeline priorities, customer exposure risks, and top actions for today.'

  const actor = recipients[0]
  const result = await runSalesAiChat({
    user: { ...actor, company: tenantKey, role: 'management' },
    message: prompt,
    pageContext: { tab: 'overview', source: 'digest' },
  })

  const excerpt = String(result.reply || '').slice(0, 1200)
  await notifyUsers(tenantKey, recipients.map((u) => String(u._id)), 'report_digest', {
    title: 'Sales Manager AI digest',
    message: excerpt,
  })
}

async function sweepSalesAiDigest() {
  if (process.env.SALES_AI_DIGEST_ENABLED !== 'true') return
  try {
    await forEachConfiguredTenantTaskDb(async (tenantKey) => {
      await runDigestForTenant(tenantKey)
    })
  } catch (e) {
    console.warn('[salesAiDigestJob]', e.message)
  }
}

function startSalesAiDigestJob() {
  if (process.env.SALES_AI_DIGEST_ENABLED !== 'true') return null
  const id = setInterval(sweepSalesAiDigest, INTERVAL_MS)
  setTimeout(sweepSalesAiDigest, 60_000)
  return id
}

module.exports = { startSalesAiDigestJob, sweepSalesAiDigest }

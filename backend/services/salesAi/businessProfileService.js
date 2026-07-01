const SalesAiBusinessProfile = require('../../models/SalesAiBusinessProfile')

const DEFAULT_PROFILE = {
  targetRegions: ['Uzbekistan', 'UAE', 'GCC'],
  productFocus: 'Gold and silver jewelry wholesale, bullion distribution',
  icpDescription: 'B2B jewelry manufacturers, refiners, and wholesale distributors',
  quarterlyGoals: '',
  competitors: [],
  riskAppetite: 'balanced',
}

async function getBusinessProfile() {
  const doc = await SalesAiBusinessProfile.findOne({}).lean()
  if (!doc) return { ...DEFAULT_PROFILE }
  return {
    targetRegions: doc.targetRegions || [],
    productFocus: doc.productFocus || '',
    icpDescription: doc.icpDescription || '',
    quarterlyGoals: doc.quarterlyGoals || '',
    competitors: doc.competitors || [],
    riskAppetite: doc.riskAppetite || '',
    updatedAt: doc.updatedAt,
    updatedByName: doc.updatedByName,
  }
}

async function upsertBusinessProfile(data, user) {
  const payload = {
    targetRegions: Array.isArray(data.targetRegions) ? data.targetRegions.map(String).filter(Boolean) : [],
    productFocus: String(data.productFocus || '').slice(0, 2000),
    icpDescription: String(data.icpDescription || '').slice(0, 2000),
    quarterlyGoals: String(data.quarterlyGoals || '').slice(0, 2000),
    competitors: Array.isArray(data.competitors) ? data.competitors.map(String).filter(Boolean).slice(0, 20) : [],
    riskAppetite: ['conservative', 'balanced', 'aggressive', ''].includes(data.riskAppetite)
      ? data.riskAppetite
      : '',
    updatedBy: user?._id,
    updatedByName: user?.name,
  }
  const doc = await SalesAiBusinessProfile.findOneAndUpdate({}, payload, { upsert: true, new: true }).lean()
  return doc
}

function formatBusinessProfileForPrompt(profile) {
  const p = profile || DEFAULT_PROFILE
  return [
    p.productFocus ? `Product focus: ${p.productFocus}` : null,
    p.icpDescription ? `ICP: ${p.icpDescription}` : null,
    p.targetRegions?.length ? `Target regions: ${p.targetRegions.join(', ')}` : null,
    p.quarterlyGoals ? `Quarterly goals: ${p.quarterlyGoals}` : null,
    p.competitors?.length ? `Competitors to watch: ${p.competitors.join(', ')}` : null,
    p.riskAppetite ? `Risk appetite: ${p.riskAppetite}` : null,
  ].filter(Boolean).join('\n')
}

module.exports = {
  getBusinessProfile,
  upsertBusinessProfile,
  formatBusinessProfileForPrompt,
  DEFAULT_PROFILE,
}

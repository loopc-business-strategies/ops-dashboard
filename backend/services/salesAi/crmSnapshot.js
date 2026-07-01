const CrmContact = require('../../models/CrmContact')
const CrmLead = require('../../models/CrmLead')
const CrmDeal = require('../../models/CrmDeal')
const CrmActivity = require('../../models/CrmActivity')
const { canViewCrm, isSalesRep, isSalesHead } = require('../permissions/moduleAccessPolicy')

async function buildCrmSnapshot(user) {
  const now = new Date()
  const bom = new Date(now.getFullYear(), now.getMonth(), 1)
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const hasCrmAccess = canViewCrm(user)
  const repFilter = hasCrmAccess && isSalesRep(user) && !isSalesHead(user)
    ? { assignedRep: user.name }
    : {}

  const [
    totalContacts,
    activeLeads,
    hotLeads,
    deals,
    overdueFollowups,
  ] = await Promise.all([
    CrmContact.countDocuments({ isDeleted: false, ...repFilter }),
    CrmLead.countDocuments({
      isDeleted: false,
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      ...repFilter,
    }),
    CrmLead.countDocuments({
      isDeleted: false,
      temperature: { $in: ['Hot', 'Very Hot'] },
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      ...repFilter,
    }),
    CrmDeal.find({ isDeleted: false, ...repFilter }).select('stage valueUSD closedWon finalValue').lean(),
    CrmActivity.countDocuments({
      isDeleted: false,
      'nextAction.isDone': false,
      'nextAction.dueDate': { $lt: now },
      ...repFilter,
    }),
  ])

  const dealsClosedWon = deals.filter((d) => d.stage === 'Closed Won').length
  const pipelineValue = deals
    .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
    .reduce((s, d) => s + (Number(d.valueUSD) || 0), 0)
  const totalDeals = deals.length
  const wonDeals = deals.filter((d) => d.stage === 'Closed Won').length
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0
  const revenueThisMonth = deals
    .filter((d) => d.stage === 'Closed Won' && d.closedWon?.closeDate >= bom && d.closedWon?.closeDate <= eom)
    .reduce((s, d) => s + (Number(d.closedWon?.finalValue || d.valueUSD) || 0), 0)

  const summary = {
    totalContacts,
    activeLeads,
    hotLeads,
    dealsClosedWon,
    pipelineValueUSD: Math.round(pipelineValue),
    winRate,
    overdueFollowups,
    revenueThisMonthUSD: Math.round(revenueThisMonth),
  }

  if (!hasCrmAccess) {
    return {
      accessLevel: 'aggregate',
      summary,
      detail: null,
    }
  }

  const [topDeals, topLeads] = await Promise.all([
    CrmDeal.find({
      isDeleted: false,
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      ...repFilter,
    })
      .sort({ valueUSD: -1 })
      .limit(5)
      .select('name stage valueUSD probability expectedCloseDate')
      .lean(),
    CrmLead.find({
      isDeleted: false,
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      ...repFilter,
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name stage temperature estValueUSD companyName')
      .lean(),
  ])

  return {
    accessLevel: 'full',
    summary,
    detail: {
      topOpenDeals: topDeals.map((d) => ({
        title: d.name || 'Untitled deal',
        stage: d.stage,
        valueUSD: d.valueUSD,
        probability: d.probability,
        expectedCloseDate: d.expectedCloseDate,
      })),
      recentLeads: topLeads.map((l) => ({
        title: l.name || 'Untitled lead',
        stage: l.stage,
        temperature: l.temperature,
        valueUSD: l.estValueUSD,
        companyName: l.companyName,
      })),
    },
  }
}

module.exports = {
  buildCrmSnapshot,
}

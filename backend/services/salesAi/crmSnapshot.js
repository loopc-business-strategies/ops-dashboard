const CrmContact = require('../../models/CrmContact')
const CrmLead = require('../../models/CrmLead')
const CrmDeal = require('../../models/CrmDeal')
const CrmActivity = require('../../models/CrmActivity')
const { canViewCrm, isSalesRep, isSalesHead } = require('../permissions/moduleAccessPolicy')

const STALLED_DAYS = 30

function dealTitle(d) {
  return d.title || d.name || 'Deal'
}

function leadTitle(l) {
  return l.title || l.name || 'Lead'
}

async function buildCrmSnapshot(user, options = {}) {
  const now = new Date()
  const bom = new Date(now.getFullYear(), now.getMonth(), 1)
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const stalledBefore = new Date(now)
  stalledBefore.setDate(stalledBefore.getDate() - STALLED_DAYS)

  const hasCrmAccess = canViewCrm(user)
  const repFilter = hasCrmAccess && isSalesRep(user) && !isSalesHead(user)
    ? { assignedRep: user.name }
    : {}

  const dealFilter = { isDeleted: false, ...repFilter }
  if (options.dealId) dealFilter._id = options.dealId

  const [
    totalContacts,
    activeLeads,
    hotLeads,
    deals,
    overdueFollowups,
    followupsDueThisWeek,
    stalledDeals,
    leadStageGroups,
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
    CrmDeal.find(dealFilter).select('stage valueUSD closedWon finalValue updatedAt name').lean(),
    CrmActivity.countDocuments({
      isDeleted: false,
      'nextAction.isDone': false,
      'nextAction.dueDate': { $lt: now },
      ...repFilter,
    }),
    CrmActivity.countDocuments({
      isDeleted: false,
      'nextAction.isDone': false,
      'nextAction.dueDate': { $gte: now, $lte: weekEnd },
      ...repFilter,
    }),
    CrmDeal.countDocuments({
      isDeleted: false,
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      updatedAt: { $lt: stalledBefore },
      ...repFilter,
    }),
    CrmLead.aggregate([
      { $match: { isDeleted: false, stage: { $nin: ['Closed Won', 'Closed Lost'] }, ...repFilter } },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
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
    followupsDueThisWeek,
    stalledDeals,
    revenueThisMonthUSD: Math.round(revenueThisMonth),
  }

  const funnel = (leadStageGroups || []).map((g) => ({ stage: g._id, count: g.count }))

  if (!hasCrmAccess) {
    return {
      accessLevel: 'aggregate',
      summary,
      funnel,
      detail: null,
    }
  }

  const [topDeals, topLeads, upcomingFollowups] = await Promise.all([
    CrmDeal.find({
      isDeleted: false,
      stage: { $nin: ['Closed Won', 'Closed Lost'] },
      ...repFilter,
    })
      .sort({ valueUSD: -1 })
      .limit(5)
      .select('name stage valueUSD probability expectedCloseDate updatedAt')
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
    CrmActivity.find({
      isDeleted: false,
      'nextAction.isDone': false,
      'nextAction.dueDate': { $gte: now },
      ...repFilter,
    })
      .sort({ 'nextAction.dueDate': 1 })
      .limit(5)
      .select('subject nextAction assignedTo dealName contactName')
      .lean(),
  ])

  return {
    accessLevel: 'full',
    summary,
    funnel,
    detail: {
      topOpenDeals: topDeals.map((d) => ({
        title: dealTitle(d),
        stage: d.stage,
        valueUSD: d.valueUSD,
        probability: d.probability,
        expectedCloseDate: d.expectedCloseDate,
        daysInStage: d.updatedAt ? Math.floor((now - new Date(d.updatedAt)) / 86400000) : null,
      })),
      recentLeads: topLeads.map((l) => ({
        title: leadTitle(l),
        stage: l.stage,
        temperature: l.temperature,
        valueUSD: l.estValueUSD,
        companyName: l.companyName,
      })),
      upcomingFollowups: upcomingFollowups.map((a) => ({
        subject: a.subject,
        dueDate: a.nextAction?.dueDate,
        assignedTo: a.nextAction?.assignedTo,
        dealName: a.dealName,
        contactName: a.contactName,
      })),
    },
  }
}

module.exports = {
  buildCrmSnapshot,
}

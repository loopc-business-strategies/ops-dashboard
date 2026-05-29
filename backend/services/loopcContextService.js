/**
 * Gathers rich live context for LoopC built-in agent.
 * Queries tenant DB directly — no extra HTTP round-trips.
 */

const Task = require('../models/Task')
const InventoryItem = require('../models/InventoryItem')
const Transaction = require('../models/Transaction')
const Vendor = require('../models/Vendor')
const Customer = require('../models/Customer')
const Employee = require('../models/Employee')
const ChartOfAccount = require('../models/ChartOfAccount')
const Ledger = require('../models/Ledger')
const MetalRate = require('../models/MetalRate')
const CrmLead = require('../models/CrmLead')
const CrmDeal = require('../models/CrmDeal')
const CrmContact = require('../models/CrmContact')
const CrmActivity = require('../models/CrmActivity')

const NOT_DELETED = { isDeleted: { $ne: true } }

async function safeCount(Model, filter = {}) {
  try {
    return await Model.countDocuments(filter)
  } catch {
    return null
  }
}

async function safeFind(Model, filter, projection, limit = 5) {
  try {
    return await Model.find(filter, projection).sort({ updatedAt: -1 }).limit(limit).lean()
  } catch {
    return []
  }
}

function summarizeUser(user) {
  if (!user) return { name: 'User', role: 'unknown', department: '', modules: [] }
  const perms = user.modulePermissions || {}
  const modules = Object.entries(perms)
    .filter(([, v]) => v?.on !== false)
    .map(([k]) => k)
  return {
    name: user.name || user.fullName || 'User',
    role: user.role || 'department_user',
    department: user.department || '',
    email: user.email || '',
    modules,
    isAdmin: user.role === 'super_admin',
  }
}

async function gatherErpSnapshot() {
  const [
    inventoryItems,
    lowStock,
    vendors,
    customers,
    accounts,
    ledgerEntries,
    draftVouchers,
    postedVouchers,
    pendingVouchers,
    recentVouchers,
  ] = await Promise.all([
    safeCount(InventoryItem, NOT_DELETED),
    safeCount(InventoryItem, { ...NOT_DELETED, $expr: { $lte: ['$quantity', '$minThreshold'] }, minThreshold: { $gt: 0 } }),
    safeCount(Vendor, NOT_DELETED),
    safeCount(Customer, NOT_DELETED),
    safeCount(ChartOfAccount, NOT_DELETED),
    safeCount(Ledger, NOT_DELETED),
    safeCount(Transaction, { ...NOT_DELETED, status: 'draft' }),
    safeCount(Transaction, { ...NOT_DELETED, status: 'posted' }),
    safeCount(Transaction, { ...NOT_DELETED, status: { $in: ['submitted', 'approved'] } }),
    safeFind(Transaction, NOT_DELETED, { type: 1, status: 1, amount: 1, date: 1, description: 1 }, 5),
  ])

  return {
    inventoryItems,
    lowStock,
    vendors,
    customers,
    accounts,
    ledgerEntries,
    vouchers: { draft: draftVouchers, posted: postedVouchers, pending: pendingVouchers },
    recentVouchers: recentVouchers.map((v) => ({
      type: v.type,
      status: v.status,
      amount: v.amount,
      date: v.date,
      description: String(v.description || '').slice(0, 60),
    })),
  }
}

async function gatherCrmSnapshot() {
  const now = new Date()
  const [
    contacts,
    activeLeads,
    hotLeads,
    deals,
    overdueFollowups,
  ] = await Promise.all([
    safeCount(CrmContact, { isDeleted: false }),
    safeCount(CrmLead, { isDeleted: false, stage: { $nin: ['Closed Won', 'Closed Lost'] } }),
    safeCount(CrmLead, { isDeleted: false, temperature: { $in: ['Hot', 'Very Hot'] }, stage: { $nin: ['Closed Won', 'Closed Lost'] } }),
    safeFind(CrmDeal, { isDeleted: false }, { stage: 1, valueUSD: 1, title: 1 }, 100),
    safeCount(CrmActivity, { isDeleted: false, 'nextAction.isDone': false, 'nextAction.dueDate': { $lt: now } }),
  ])

  const pipelineValue = deals
    .filter((d) => !['Closed Won', 'Closed Lost'].includes(d.stage))
    .reduce((s, d) => s + Number(d.valueUSD || 0), 0)
  const wonDeals = deals.filter((d) => d.stage === 'Closed Won').length
  const winRate = deals.length > 0 ? Math.round((wonDeals / deals.length) * 100) : 0

  return {
    contacts,
    activeLeads,
    hotLeads,
    totalDeals: deals.length,
    pipelineValue: Math.round(pipelineValue),
    winRate,
    overdueFollowups,
  }
}

async function gatherHrSnapshot() {
  const [employees, openTasks] = await Promise.all([
    safeCount(Employee, {}),
    safeCount(Task, { ...NOT_DELETED, status: { $nin: ['done', 'cancelled'] } }),
  ])
  return { employees, openTasks }
}

async function gatherTaskSnapshot() {
  const now = new Date()
  const [open, overdue, recent] = await Promise.all([
    safeCount(Task, { ...NOT_DELETED, status: { $nin: ['done', 'cancelled'] } }),
    safeCount(Task, { ...NOT_DELETED, status: { $nin: ['done', 'cancelled'] }, dueDate: { $lt: now } }),
    safeFind(Task, NOT_DELETED, { title: 1, status: 1, dueDate: 1, priority: 1 }, 5),
  ])
  return {
    open,
    overdue,
    recent: recent.map((t) => ({
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      priority: t.priority,
    })),
  }
}

async function gatherSavedMetalRates() {
  try {
    const latest = await MetalRate.findOne().sort({ updatedAt: -1 }).lean()
    if (!latest) return null
    return {
      gold: latest.goldPrice,
      silver: latest.silverPrice,
      platinum: latest.platinumPrice,
      currency: latest.priceCurrency || 'USD',
      unit: latest.priceUnit || 'G',
      source: latest.source || 'manual',
      updatedAt: latest.updatedAt,
    }
  } catch {
    return null
  }
}

async function gatherLoopcSnapshot({ user, tenant, metals, build, pageContext, lastError }) {
  const [erp, crm, hr, tasks, savedRates] = await Promise.all([
    gatherErpSnapshot(),
    gatherCrmSnapshot(),
    gatherHrSnapshot(),
    gatherTaskSnapshot(),
    gatherSavedMetalRates(),
  ])

  const alerts = []
  if (tasks.overdue > 0) alerts.push({ level: 'warning', text: `${tasks.overdue} overdue task(s)` })
  if (erp.lowStock > 0) alerts.push({ level: 'warning', text: `${erp.lowStock} inventory item(s) below minimum stock` })
  if (crm.overdueFollowups > 0) alerts.push({ level: 'info', text: `${crm.overdueFollowups} overdue CRM follow-up(s)` })
  if (erp.vouchers?.draft > 5) alerts.push({ level: 'info', text: `${erp.vouchers.draft} draft voucher(s) awaiting completion` })
  if (metals && !metals.error && !metals.live) alerts.push({ level: 'warning', text: 'Metal prices offline — MT4 bridge or market feed not live' })
  if (lastError?.status) alerts.push({ level: 'error', text: `Last API error: HTTP ${lastError.status}` })

  return {
    user: summarizeUser(user),
    tenant,
    metals,
    savedRates,
    build: build || {},
    pageContext: pageContext || {},
    lastError: lastError || null,
    erp,
    crm,
    hr,
    tasks,
    alerts,
    gatheredAt: new Date().toISOString(),
  }
}

module.exports = {
  gatherLoopcSnapshot,
  summarizeUser,
  gatherErpSnapshot,
  gatherTaskSnapshot,
}

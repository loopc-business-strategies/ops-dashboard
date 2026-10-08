const MetalRate = require('../models/MetalRate')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')
const { notifyErpUsers } = require('../services/notificationDispatch')
const { resolveMt4StaleMs } = require('../services/erpAccounting/metalValuationRates')
const { getJson, setJson, setOnce } = require('../utils/sharedCoordination')

const MT4_BRIDGE_SOURCE = 'mt4-bridge'
const CHECK_MS = 60 * 1000
const STATE_TTL_MS = 14 * 24 * 60 * 60 * 1000
const DEFAULT_ALERT_AFTER_MS = 10 * 60 * 1000

function resolveMt4OfflineAlertMs() {
  return Math.max(2 * 60 * 1000, Number(process.env.MT4_OFFLINE_ALERT_MS || DEFAULT_ALERT_AFTER_MS))
}

/**
 * Gold trades Sunday evening to Friday evening (UTC) with a one-hour daily break
 * at 21:00 or 22:00 UTC depending on daylight saving; the window covers both.
 */
function isGoldMarketClosed(date = new Date()) {
  const day = date.getUTCDay()
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  const breakStart = 20 * 60 + 55
  const breakEnd = 23 * 60 + 5
  if (day === 6) return true
  if (day === 5 && minutes >= breakStart) return true
  if (day === 0 && minutes < breakEnd) return true
  return minutes >= breakStart && minutes < breakEnd
}

function formatDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 120) return `${minutes} minutes`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`
}

/**
 * Decides what to send for one tenant: 'offline' once per outage (no MT4 price
 * for the alert window while the market was open the whole time), then 'online'
 * when prices resume. Tenants that never had an MT4 feed are ignored.
 */
function evaluateMt4Feed({ feedUpdatedAt, state = null, now = Date.now(), alertAfterMs = resolveMt4OfflineAlertMs(), staleMs = resolveMt4StaleMs() }) {
  if (!feedUpdatedAt) return { action: 'none' }
  const feedMs = new Date(feedUpdatedAt).getTime()
  if (!Number.isFinite(feedMs)) return { action: 'none' }
  const ageMs = now - feedMs
  const alertedFeedMs = state?.alertedFeedAt ? new Date(state.alertedFeedAt).getTime() : null

  if (alertedFeedMs !== null) {
    if (feedMs > alertedFeedMs && ageMs <= staleMs) return { action: 'online', outageMs: feedMs - alertedFeedMs }
    return { action: 'none' }
  }
  if (ageMs < alertAfterMs) return { action: 'none' }
  if (isGoldMarketClosed(new Date(now)) || isGoldMarketClosed(new Date(now - alertAfterMs))) return { action: 'none' }
  return { action: 'offline', ageMs }
}

async function checkTenantMt4Feed(tenantKey, { now = Date.now(), notify = notifyErpUsers } = {}) {
  const latest = await MetalRate.findOne({ source: MT4_BRIDGE_SOURCE }).sort({ updatedAt: -1 }).select('updatedAt').lean()
  const stateKey = `mt4-feed-watch:${tenantKey}`
  const state = await getJson(stateKey)
  const result = evaluateMt4Feed({ feedUpdatedAt: latest?.updatedAt, state, now })
  const feedAt = latest?.updatedAt ? new Date(latest.updatedAt).toISOString() : null

  if (result.action === 'offline') {
    if (!(await setOnce(`mt4-feed-offline:${tenantKey}:${feedAt}`, STATE_TTL_MS))) return result
    await setJson(stateKey, { alertedFeedAt: feedAt }, STATE_TTL_MS)
    await notify(tenantKey, 'mt4_feed_alert', {
      status: 'offline',
      feedUpdatedAt: feedAt,
      message: `No MT4 price for ${formatDuration(result.ageMs)}. Prices and margins are using the server market price. Check the MT4 terminal, the price bridge EA and AutoTrading.`,
    })
  } else if (result.action === 'online') {
    if (!(await setOnce(`mt4-feed-online:${tenantKey}:${state.alertedFeedAt}`, STATE_TTL_MS))) return result
    await setJson(stateKey, {}, 1000)
    await notify(tenantKey, 'mt4_feed_alert', {
      status: 'online',
      feedUpdatedAt: feedAt,
      message: `MT4 prices are back after ${formatDuration(result.outageMs)}.`,
    })
  }
  return result
}

async function runMt4FeedWatch() {
  try {
    await forEachConfiguredTenantTaskDb((tenantKey) => checkTenantMt4Feed(tenantKey))
  } catch (e) {
    console.warn('[mt4FeedWatchJob]', e.message)
  }
}

function startMt4FeedWatchJob() {
  if (String(process.env.MT4_FEED_WATCH_JOB || 'true').toLowerCase() === 'false') return () => {}
  const id = setInterval(runMt4FeedWatch, CHECK_MS)
  return () => clearInterval(id)
}

module.exports = {
  isGoldMarketClosed,
  evaluateMt4Feed,
  checkTenantMt4Feed,
  runMt4FeedWatch,
  startMt4FeedWatchJob,
}

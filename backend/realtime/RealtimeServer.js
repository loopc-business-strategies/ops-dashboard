/**
 * Socket.io real-time infrastructure
 * Enables live updates for dashboards, reports, and collaborative features
 */

const socketIO = require('socket.io')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { normalizeTenant, resolveTenantFromHost } = require('../config/tenants')
const { sendExpoPushToUser } = require('../services/expoPushNotifications')
const { sendWebPushToUser } = require('../services/webPushNotifications')
const { readSessionTokenFromCookieMap } = require('../utils/tenantSessionCookies')
const {
  registerConnection,
  unregisterConnection,
  getOnlineUserIds,
} = require('../services/userPresence')

function resolveSocketTenantSubscription(socket, requestedTenant) {
  const authenticatedTenant = normalizeTenant(socket?.tenant)
  const normalizedRequestedTenant = normalizeTenant(requestedTenant)

  if (!authenticatedTenant) {
    throw new Error('Authenticated tenant is missing')
  }

  if (normalizedRequestedTenant && normalizedRequestedTenant !== authenticatedTenant) {
    throw new Error('Requested tenant does not match authenticated session')
  }

  return authenticatedTenant
}

/**
 * Resolve dashboard metrics room for an authenticated socket.
 * Returns { ok, tenant, room } or { ok: false, error }.
 */
function handleDashboardMetricsSubscribe(socket, requestedTenant) {
  try {
    const tenant = resolveSocketTenantSubscription(socket, requestedTenant)
    return { ok: true, tenant, room: `dashboard:metrics:${tenant}` }
  } catch (err) {
    return { ok: false, error: err }
  }
}

let socketIoRedisAdapterAttached = false

function getSocketIoRedisAdapterAttached() {
  return socketIoRedisAdapterAttached
}

function redisUrlForSocketAdapter() {
  return String(process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || '').trim()
}

function notificationUserRoom(tenant, userId) {
  return `notifications:user:${String(tenant || '').trim()}:${String(userId || '').trim()}`
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf('=')
      if (eqIndex === -1) return acc
      const key = decodeURIComponent(part.slice(0, eqIndex).trim())
      const value = decodeURIComponent(part.slice(eqIndex + 1).trim())
      if (key) acc[key] = value
      return acc
    }, {})
}

function getSocketToken(socket) {
  const authToken = String(socket.handshake?.auth?.token || '').trim()
  if (authToken && authToken !== 'browser-session' && authToken !== 'cookie-session') {
    return authToken
  }

  const authHeader = String(socket.handshake?.headers?.authorization || '').trim()
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }

  const cookies = parseCookies(socket.handshake?.headers?.cookie)
  const headerTenant = normalizeTenant(socket.handshake?.headers?.['x-tenant'] || socket.handshake?.headers?.['x-company'])
  const host = getSocketHostname(socket)
  return readSessionTokenFromCookieMap(cookies, { hostname: host, headerTenant }) || ''
}

function getSocketHostname(socket) {
  const forwardedHost = String(socket.handshake?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(socket.handshake?.headers?.host || '').trim()
  return host.replace(/:\d+$/, '')
}

async function authenticateSocket(socket) {
  const token = getSocketToken(socket)
  if (!token) throw new Error('Authentication error')

  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
  const tenant = normalizeTenant(decoded.company)
  if (!tenant) throw new Error('Invalid tenant in session')

  const headerTenant = normalizeTenant(socket.handshake?.headers?.['x-tenant'] || socket.handshake?.headers?.['x-company'])
  const hostTenant = resolveTenantFromHost(getSocketHostname(socket), headerTenant || tenant)
  if (hostTenant !== tenant) throw new Error('Session tenant does not match this company portal')

  const TenantUser = await User.getTenantModel(tenant)
  const user = await TenantUser.findById(decoded.id).select('_id name role isActive isDeleted')
  if (!user || user.isDeleted || !user.isActive) throw new Error('User is not active')

  socket.userId = String(user._id)
  socket.tenant = tenant
  socket.userRole = user.role
  return socket
}

/**
 * Build the socket.io CORS origin list from the same env vars used by Express CORS.
 * CLIENT_URLS – comma-separated list (preferred)
 * CLIENT_URL  – single origin (legacy)
 * FRONTEND_URL – legacy single origin kept for backwards compatibility
 * Falls back to localhost in development.
 */
function buildSocketOrigins() {
  const raw = [
    ...(process.env.CLIENT_URLS || '').split(','),
    ...(process.env.CLIENT_URL  || '').split(','),
    ...(process.env.FRONTEND_URL || '').split(','),
  ]
  const origins = raw.map((s) => s.trim()).filter(Boolean)
  return origins.length ? origins : ['http://localhost:5173']
}

/** Allow browser allowlist + React Native Expo origins in non-production only. */
function buildSocketCorsOriginValidator() {
  const allowedList = buildSocketOrigins()
  const isProduction = process.env.NODE_ENV === 'production'
  return (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedList.includes(origin)) return callback(null, true)
    if (!isProduction && (origin.startsWith('exp://') || origin.startsWith('exps://'))) {
      return callback(null, true)
    }
    if (!isProduction) {
      try {
        const url = new URL(origin)
        const local =
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          url.hostname === '::1' ||
          url.hostname.endsWith('.localhost')
        if (local) return callback(null, true)
      } catch {
        // ignore
      }
    }
    callback(new Error('Not allowed by CORS'))
  }
}

class RealtimeServer {
  constructor(httpServer) {
    this.io = socketIO(httpServer, {
      cors: {
        origin: buildSocketCorsOriginValidator(),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })
    this.redisAdapterAttached = false
    this._redisPubClient = null
    this._redisSubClient = null

    this.setupMiddleware()
    this.setupNamespaces()
  }

  /**
   * Attach @socket.io/redis-adapter when REDIS_URL is set so broadcasts
   * reach sockets on other Railway replicas. Soft-fails to in-memory adapter.
   * @returns {Promise<boolean>} true when adapter is attached
   */
  async attachRedisAdapter() {
    const url = redisUrlForSocketAdapter()
    if (!url) {
      this.redisAdapterAttached = false
      socketIoRedisAdapterAttached = false
      return false
    }

    try {
      const { createClient } = require('redis')
      const { createAdapter } = require('@socket.io/redis-adapter')
      const pubClient = createClient({ url })
      const subClient = pubClient.duplicate()
      pubClient.on('error', (err) => {
        console.warn('[realtime] redis pub error', err?.message || err)
      })
      subClient.on('error', (err) => {
        console.warn('[realtime] redis sub error', err?.message || err)
      })
      await Promise.all([pubClient.connect(), subClient.connect()])
      this.io.adapter(createAdapter(pubClient, subClient))
      this._redisPubClient = pubClient
      this._redisSubClient = subClient
      this.redisAdapterAttached = true
      socketIoRedisAdapterAttached = true
      console.log('[realtime] Socket.IO Redis adapter attached')
      return true
    } catch (err) {
      this.redisAdapterAttached = false
      socketIoRedisAdapterAttached = false
      console.warn(
        '[realtime] Socket.IO Redis adapter unavailable; using in-memory adapter',
        err?.message || err,
      )
      return false
    }
  }

  setupMiddleware() {
    this.authMiddleware = async (socket, next) => {
      try {
        await authenticateSocket(socket)
        next()
      } catch {
        next(new Error('Authentication error'))
      }
    }

    this.io.use(this.authMiddleware)
  }

  setupNamespaces() {
    /**
     * Dashboard namespace: broadcast dashboard updates to subscribed clients
     */
    const dashboardNamespace = this.io.of('/dashboard')
    dashboardNamespace.use(this.authMiddleware)
    dashboardNamespace.on('connection', (socket) => {
      socket.on('subscribe:metrics', (tenant) => {
        const result = handleDashboardMetricsSubscribe(socket, tenant)
        if (!result.ok) {
          socket.emit('subscription:error', {
            namespace: '/dashboard',
            message: 'Tenant subscription denied',
          })
          return
        }
        socket.join(result.room)
        socket.emit('subscribed', {
          namespace: '/dashboard',
          metric: 'metrics',
          tenant: result.tenant,
        })
      })

      socket.on('unsubscribe:metrics', (tenant) => {
        const result = handleDashboardMetricsSubscribe(socket, tenant)
        if (!result.ok) {
          socket.emit('subscription:error', {
            namespace: '/dashboard',
            message: 'Tenant subscription denied',
          })
          return
        }
        socket.leave(result.room)
      })
    })

    /**
     * Reports namespace: broadcast report generation status
     */
    const reportsNamespace = this.io.of('/reports')
    reportsNamespace.use(this.authMiddleware)
    reportsNamespace.on('connection', (socket) => {
      // Subscribe to report generation updates
      socket.on('subscribe:report', (reportId) => {
        socket.join(`report:${reportId}`)
        socket.emit('subscribed', { report: reportId })
      })
    })

    /**
     * Ledger namespace: broadcast ledger entry updates
     */
    const ledgerNamespace = this.io.of('/ledger')
    ledgerNamespace.use(this.authMiddleware)
    ledgerNamespace.on('connection', (socket) => {
      socket.on('subscribe:tenant', (tenant) => {
        try {
          const subscriptionTenant = resolveSocketTenantSubscription(socket, tenant)
          socket.join(`ledger:tenant:${subscriptionTenant}`)
          socket.emit('subscribed', { namespace: '/ledger', tenant: subscriptionTenant })
        } catch {
          socket.emit('subscription:error', { namespace: '/ledger', message: 'Tenant subscription denied' })
        }
      })

      // Subscribe to account ledger updates
      socket.on('subscribe:account', (accountId) => {
        socket.join(`ledger:account:${accountId}`)
      })

      socket.on('unsubscribe:account', (accountId) => {
        socket.leave(`ledger:account:${accountId}`)
      })
    })

    /**
     * Transactions namespace: broadcast transaction workflow updates
     */
    const transactionsNamespace = this.io.of('/transactions')
    transactionsNamespace.use(this.authMiddleware)
    transactionsNamespace.on('connection', (socket) => {
      socket.on('subscribe:tenant', (tenant) => {
        try {
          const subscriptionTenant = resolveSocketTenantSubscription(socket, tenant)
          socket.join(`transactions:tenant:${subscriptionTenant}`)
          socket.emit('subscribed', { namespace: '/transactions', tenant: subscriptionTenant })
        } catch {
          socket.emit('subscription:error', { namespace: '/transactions', message: 'Tenant subscription denied' })
        }
      })
    })

    /**
     * Metal rates namespace: broadcast live spot updates from the MT4 bridge.
     */
    const metalRatesNamespace = this.io.of('/metal-rates')
    metalRatesNamespace.use(this.authMiddleware)
    metalRatesNamespace.on('connection', (socket) => {
      socket.on('subscribe:tenant', (tenant) => {
        try {
          const subscriptionTenant = resolveSocketTenantSubscription(socket, tenant)
          socket.join(`metal-rates:tenant:${subscriptionTenant}`)
          socket.emit('subscribed', { namespace: '/metal-rates', tenant: subscriptionTenant })
        } catch {
          socket.emit('subscription:error', { namespace: '/metal-rates', message: 'Tenant subscription denied' })
        }
      })
    })

    /**
     * Notifications namespace: broadcast user notifications
     */
    const notificationsNamespace = this.io.of('/notifications')
    notificationsNamespace.use(this.authMiddleware)
    notificationsNamespace.on('connection', async (socket) => {
      const tenant = socket.tenant
      const userId = socket.userId
      socket.join(notificationUserRoom(tenant, userId))
      socket.join(`tenant:${tenant}`)

      try {
        const { becameOnline } = await registerConnection(tenant, userId)
        const onlineUserIds = await getOnlineUserIds(tenant)
        socket.emit('presence:snapshot', { onlineUserIds })
        if (becameOnline) {
          this.broadcastPresenceUpdate(tenant, { userId, online: true })
        }
      } catch (err) {
        console.warn('[presence] connect error', err?.message || err)
      }

      socket.on('disconnect', async () => {
        try {
          const { becameOffline } = await unregisterConnection(tenant, userId)
          if (becameOffline) {
            this.broadcastPresenceUpdate(tenant, { userId, online: false })
          }
        } catch (err) {
          console.warn('[presence] disconnect error', err?.message || err)
        }
      })
    })
  }

  broadcastPresenceUpdate(tenant, payload = {}) {
    this.io.of('/notifications').to(`tenant:${tenant}`).emit('presence:update', {
      timestamp: new Date(),
      ...payload,
    })
  }


  /**
   * Broadcast dashboard metrics update
   * @param {String} tenant - Tenant identifier
   * @param {Object} metrics - Dashboard metrics payload
   */
  broadcastMetricsUpdate(tenant, metrics) {
    this.io.of('/dashboard').to(`dashboard:metrics:${tenant}`).emit('metrics:update', {
      timestamp: new Date(),
      data: metrics,
    })
  }

  /**
   * Broadcast ledger entry creation
   * @param {String} accountId - Account ID
   * @param {Object} entry - Ledger entry payload
   */
  broadcastLedgerEntry(accountId, entry) {
    this.io.of('/ledger').to(`ledger:account:${accountId}`).emit('entry:created', {
      timestamp: new Date(),
      data: entry,
    })
  }

  /**
   * Broadcast tenant-wide ledger updates
   * @param {String} tenant - Tenant key
   * @param {Object} payload - Update payload
   */
  broadcastLedgerUpdate(tenant, payload = {}) {
    this.io.of('/ledger').to(`ledger:tenant:${tenant}`).emit('ledger:update', {
      timestamp: new Date(),
      ...payload,
    })
  }

  /**
   * Broadcast tenant-wide transaction updates
   * @param {String} tenant - Tenant key
   * @param {Object} payload - Update payload
   */
  broadcastTransactionUpdate(tenant, payload = {}) {
    this.io.of('/transactions').to(`transactions:tenant:${tenant}`).emit('transaction:update', {
      timestamp: new Date(),
      ...payload,
    })
  }

  /**
   * Broadcast tenant-wide metal-rate updates
   * @param {String} tenant - Tenant key
   * @param {Object} payload - Latest rate payload
   */
  broadcastMetalRatesUpdate(tenant, payload = {}) {
    this.io.of('/metal-rates').to(`metal-rates:tenant:${tenant}`).emit('metal-rates:update', {
      timestamp: new Date(),
      ...payload,
    })
  }

  /**
   * Broadcast report generation progress
   * @param {String} reportId - Report identifier
   * @param {String} status - 'pending' | 'processing' | 'completed' | 'failed'
   * @param {Object} payload - Status payload
   */
  broadcastReportStatus(reportId, status, payload = {}) {
    this.io.of('/reports').to(`report:${reportId}`).emit('report:status', {
      status,
      timestamp: new Date(),
      ...payload,
    })
  }

  /**
   * Send notification to specific user
   * @param {String} userId - User ID
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   * @param {String} [tenantKey] - mg/cg/loopc for Expo push (optional)
   */
  sendUserNotification(userId, type, data, tenantKey) {
    const tenant = String(tenantKey || '').trim()
    if (!tenant) {
      console.warn('[realtime] sendUserNotification skipped socket emit — tenantKey required')
    } else {
      this.io.of('/notifications').to(notificationUserRoom(tenant, userId)).emit('notification', {
        type,
        timestamp: new Date(),
        data,
      })
    }
    if (tenantKey) {
      sendExpoPushToUser(tenantKey, userId, type, data).catch((err) => {
        console.warn('[expo-push] async error:', err?.message || err)
      })
      sendWebPushToUser(tenantKey, userId, type, data).catch((err) => {
        console.warn('[web-push] async error:', err?.message || err)
      })
    }
  }

  /**
   * Get connection count for monitoring
   */
  getConnectionStats() {
    const namespaceCount = (namespace) => this.io.of(namespace).sockets?.size || 0
    return {
      total: namespaceCount('/dashboard') + namespaceCount('/reports') + namespaceCount('/ledger') + namespaceCount('/transactions') + namespaceCount('/metal-rates') + namespaceCount('/notifications'),
      dashboard: namespaceCount('/dashboard'),
      reports: namespaceCount('/reports'),
      ledger: namespaceCount('/ledger'),
      transactions: namespaceCount('/transactions'),
      metalRates: namespaceCount('/metal-rates'),
      notifications: namespaceCount('/notifications'),
    }
  }
}

module.exports = RealtimeServer
module.exports.authenticateSocket = authenticateSocket
module.exports.getSocketToken = getSocketToken
module.exports.resolveSocketTenantSubscription = resolveSocketTenantSubscription
module.exports.handleDashboardMetricsSubscribe = handleDashboardMetricsSubscribe
module.exports.getSocketIoRedisAdapterAttached = getSocketIoRedisAdapterAttached
module.exports.notificationUserRoom = notificationUserRoom

/**
 * Socket.io real-time infrastructure
 * Enables live updates for dashboards, reports, and collaborative features
 */

const socketIO = require('socket.io')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { normalizeTenant, resolveTenantFromHost } = require('../config/tenants')

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
  return cookies.sessionToken || ''
}

function getSocketHostname(socket) {
  const forwardedHost = String(socket.handshake?.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const host = forwardedHost || String(socket.handshake?.headers?.host || '').trim()
  return host.replace(/:\d+$/, '')
}

async function authenticateSocket(socket) {
  const token = getSocketToken(socket)
  if (!token) throw new Error('Authentication error')

  const decoded = jwt.verify(token, process.env.JWT_SECRET)
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

class RealtimeServer {
  constructor(httpServer) {
    this.io = socketIO(httpServer, {
      cors: {
        origin: buildSocketOrigins(),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    })

    this.setupMiddleware()
    this.setupNamespaces()
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
      // Subscribe to dashboard metrics updates
      socket.on('subscribe:metrics', (tenant) => {
        socket.join(`dashboard:metrics:${tenant}`)
        socket.emit('subscribed', { namespace: '/dashboard', metric: 'metrics', tenant })
      })

      // Unsubscribe from dashboard metrics
      socket.on('unsubscribe:metrics', (tenant) => {
        socket.leave(`dashboard:metrics:${tenant}`)
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
     * Metal rates namespace: broadcast live spot updates from the MT5 bridge.
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
    notificationsNamespace.on('connection', (socket) => {
      socket.join(`user:${socket.userId}`)
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
   */
  sendUserNotification(userId, type, data) {
    this.io.of('/notifications').to(`user:${userId}`).emit('notification', {
      type,
      timestamp: new Date(),
      data,
    })
  }

  /**
   * Get connection count for monitoring
   */
  getConnectionStats() {
    const namespaceCount = (namespace) => Object.keys(this.io.of(namespace).sockets || {}).length
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

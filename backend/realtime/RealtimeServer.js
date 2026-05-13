/**
 * Socket.io real-time infrastructure
 * Enables live updates for dashboards, reports, and collaborative features
 */

const socketIO = require('socket.io')

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
    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error'))
      }
      // Token validation would be done by JWT middleware
      socket.userId = socket.handshake.auth.userId
      next()
    })
  }

  setupNamespaces() {
    /**
     * Dashboard namespace: broadcast dashboard updates to subscribed clients
     */
    this.io.of('/dashboard').on('connection', (socket) => {
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
    this.io.of('/reports').on('connection', (socket) => {
      // Subscribe to report generation updates
      socket.on('subscribe:report', (reportId) => {
        socket.join(`report:${reportId}`)
        socket.emit('subscribed', { report: reportId })
      })
    })

    /**
     * Ledger namespace: broadcast ledger entry updates
     */
    this.io.of('/ledger').on('connection', (socket) => {
      socket.on('subscribe:tenant', (tenant) => {
        socket.join(`ledger:tenant:${tenant}`)
        socket.emit('subscribed', { namespace: '/ledger', tenant })
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
    this.io.of('/transactions').on('connection', (socket) => {
      socket.on('subscribe:tenant', (tenant) => {
        socket.join(`transactions:tenant:${tenant}`)
        socket.emit('subscribed', { namespace: '/transactions', tenant })
      })
    })

    /**
     * Notifications namespace: broadcast user notifications
     */
    this.io.of('/notifications').on('connection', (socket) => {
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
      total: namespaceCount('/dashboard') + namespaceCount('/reports') + namespaceCount('/ledger') + namespaceCount('/transactions') + namespaceCount('/notifications'),
      dashboard: namespaceCount('/dashboard'),
      reports: namespaceCount('/reports'),
      ledger: namespaceCount('/ledger'),
      transactions: namespaceCount('/transactions'),
      notifications: namespaceCount('/notifications'),
    }
  }
}

module.exports = RealtimeServer

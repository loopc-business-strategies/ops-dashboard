/**
 * Socket.io real-time infrastructure
 * Enables live updates for dashboards, reports, and collaborative features
 */

const socketIO = require('socket.io')

class RealtimeServer {
  constructor(httpServer) {
    this.io = socketIO(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
      console.log(`[Dashboard] User ${socket.userId} connected`)

      // Subscribe to dashboard metrics updates
      socket.on('subscribe:metrics', (tenant) => {
        socket.join(`dashboard:metrics:${tenant}`)
        socket.emit('subscribed', { namespace: '/dashboard', metric: 'metrics', tenant })
      })

      // Unsubscribe from dashboard metrics
      socket.on('unsubscribe:metrics', (tenant) => {
        socket.leave(`dashboard:metrics:${tenant}`)
      })

      socket.on('disconnect', () => {
        console.log(`[Dashboard] User ${socket.userId} disconnected`)
      })
    })

    /**
     * Reports namespace: broadcast report generation status
     */
    this.io.of('/reports').on('connection', (socket) => {
      console.log(`[Reports] User ${socket.userId} connected`)

      // Subscribe to report generation updates
      socket.on('subscribe:report', (reportId) => {
        socket.join(`report:${reportId}`)
        socket.emit('subscribed', { report: reportId })
      })

      socket.on('disconnect', () => {
        console.log(`[Reports] User ${socket.userId} disconnected`)
      })
    })

    /**
     * Ledger namespace: broadcast ledger entry updates
     */
    this.io.of('/ledger').on('connection', (socket) => {
      console.log(`[Ledger] User ${socket.userId} connected`)

      // Subscribe to account ledger updates
      socket.on('subscribe:account', (accountId) => {
        socket.join(`ledger:account:${accountId}`)
      })

      socket.on('unsubscribe:account', (accountId) => {
        socket.leave(`ledger:account:${accountId}`)
      })

      socket.on('disconnect', () => {
        console.log(`[Ledger] User ${socket.userId} disconnected`)
      })
    })

    /**
     * Notifications namespace: broadcast user notifications
     */
    this.io.of('/notifications').on('connection', (socket) => {
      console.log(`[Notifications] User ${socket.userId} connected`)
      socket.join(`user:${socket.userId}`)

      socket.on('disconnect', () => {
        console.log(`[Notifications] User ${socket.userId} disconnected`)
      })
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
    return {
      total: Object.keys(this.io.of('/dashboard').sockets.sockets).length,
      dashboard: Object.keys(this.io.of('/dashboard').sockets.sockets).length,
      reports: Object.keys(this.io.of('/reports').sockets.sockets).length,
      ledger: Object.keys(this.io.of('/ledger').sockets.sockets).length,
      notifications: Object.keys(this.io.of('/notifications').sockets.sockets).length,
    }
  }
}

module.exports = RealtimeServer

import { subscribeRealtimeEvents, parseRealtimeEventData } from './realtimeEventsBus'
import { buildRealtimeEventsUrl, buildRealtimeNamespaceUrl } from './realtimeUrl'

export { buildRealtimeEventsUrl }

let ioModulePromise = null

const loadIo = () => {
  if (!ioModulePromise) {
    ioModulePromise = import('socket.io-client').then((mod) => mod.io)
  }
  return ioModulePromise
}

const createSocket = async (namespace, token, tenant) => {
  const io = await loadIo()
  const tenantKey = String(tenant || '').trim()
  return io(buildRealtimeNamespaceUrl(namespace), {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    extraHeaders: tenantKey ? { 'x-tenant': tenantKey, 'x-company': tenantKey } : undefined,
    auth: {
      token: token || 'browser-session',
      userId: 'erp-client',
    },
  })
}

export const startERPRealtimeFeeds = ({
  token,
  tenant,
  onLedgerUpdate,
  onTransactionUpdate,
  enableLedger = true,
  enableTransactions = true,
}) => {
  const tenantKey = String(tenant || '').trim()
  if (!tenantKey) return () => {}

  let cancelled = false
  const sockets = []
  const debounceMs = 400
  let ledgerTimer = null
  let txTimer = null

  const debouncedLedger = typeof onLedgerUpdate === 'function'
    ? () => {
      if (ledgerTimer) window.clearTimeout(ledgerTimer)
      ledgerTimer = window.setTimeout(() => {
        ledgerTimer = null
        onLedgerUpdate()
      }, debounceMs)
    }
    : null

  const debouncedTx = typeof onTransactionUpdate === 'function'
    ? () => {
      if (txTimer) window.clearTimeout(txTimer)
      txTimer = window.setTimeout(() => {
        txTimer = null
        onTransactionUpdate()
      }, debounceMs)
    }
    : null

  ;(async () => {
    try {
      if (enableLedger && debouncedLedger) {
        const ledgerSocket = await createSocket('/ledger', token, tenantKey)
        if (cancelled) {
          ledgerSocket.disconnect()
          return
        }
        ledgerSocket.on('connect', () => {
          ledgerSocket.emit('subscribe:tenant', tenantKey)
        })
        ledgerSocket.on('ledger:update', debouncedLedger)
        sockets.push({ socket: ledgerSocket, event: 'ledger:update', handler: debouncedLedger })
      }

      if (cancelled) return

      if (enableTransactions && debouncedTx) {
        const transactionSocket = await createSocket('/transactions', token, tenantKey)
        if (cancelled) {
          transactionSocket.disconnect()
          return
        }
        transactionSocket.on('connect', () => {
          transactionSocket.emit('subscribe:tenant', tenantKey)
        })
        transactionSocket.on('transaction:update', debouncedTx)
        sockets.push({ socket: transactionSocket, event: 'transaction:update', handler: debouncedTx })
      }
    } catch {
      /* socket.io load/connect failures are non-fatal for dashboard shell */
    }
  })()

  return () => {
    cancelled = true
    if (ledgerTimer) window.clearTimeout(ledgerTimer)
    if (txTimer) window.clearTimeout(txTimer)
    sockets.forEach(({ socket, event, handler }) => {
      socket.off(event, handler)
      socket.disconnect()
    })
  }
}

export const startMetalRatesRealtime = ({ token, tenant, onRatesUpdate, onConnect }) => {
  const tenantKey = String(tenant || '').trim()
  if (!tenantKey || typeof onRatesUpdate !== 'function') return () => {}

  let cancelled = false
  let socket = null

  ;(async () => {
    try {
      socket = await createSocket('/metal-rates', token, tenantKey)
      if (cancelled) {
        socket.disconnect()
        return
      }
      socket.on('connect', () => {
        socket.emit('subscribe:tenant', tenantKey)
        if (typeof onConnect === 'function') onConnect()
      })
      socket.on('metal-rates:update', onRatesUpdate)
    } catch {
      /* ignore */
    }
  })()

  return () => {
    cancelled = true
    if (!socket) return
    socket.off('metal-rates:update', onRatesUpdate)
    socket.off('connect')
    socket.disconnect()
  }
}

export const startProjectsSse = ({ tenant, onReminderDue }) => {
  if (typeof onReminderDue !== 'function') return () => {}

  return subscribeRealtimeEvents(tenant, 'task.reminder_due', (ev) => {
    onReminderDue(parseRealtimeEventData(ev, {}))
  })
}

export const startUserNotifications = ({
  token,
  tenant,
  onNotification,
  onPresenceSnapshot,
  onPresenceUpdate,
}) => {
  if (typeof onNotification !== 'function' && typeof onPresenceSnapshot !== 'function' && typeof onPresenceUpdate !== 'function') {
    return () => {}
  }

  let cancelled = false
  let notificationSocket = null

  ;(async () => {
    try {
      notificationSocket = await createSocket('/notifications', token, tenant)
      if (cancelled) {
        notificationSocket.disconnect()
        return
      }

      if (typeof onNotification === 'function') {
        notificationSocket.on('notification', onNotification)
      }

      if (typeof onPresenceSnapshot === 'function') {
        notificationSocket.on('presence:snapshot', (payload) => {
          const onlineUserIds = Array.isArray(payload?.onlineUserIds) ? payload.onlineUserIds.map(String) : []
          onPresenceSnapshot(onlineUserIds)
        })
      }

      if (typeof onPresenceUpdate === 'function') {
        notificationSocket.on('presence:update', (payload) => {
          onPresenceUpdate({
            userId: String(payload?.userId || ''),
            online: Boolean(payload?.online),
          })
        })
      }
    } catch {
      /* ignore */
    }
  })()

  return () => {
    cancelled = true
    if (!notificationSocket) return
    if (typeof onNotification === 'function') {
      notificationSocket.off('notification', onNotification)
    }
    if (typeof onPresenceSnapshot === 'function') {
      notificationSocket.off('presence:snapshot')
    }
    if (typeof onPresenceUpdate === 'function') {
      notificationSocket.off('presence:update')
    }
    notificationSocket.disconnect()
  }
}

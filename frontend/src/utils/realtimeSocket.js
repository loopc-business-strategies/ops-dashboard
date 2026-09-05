import { io } from 'socket.io-client'
import { subscribeRealtimeEvents, parseRealtimeEventData } from './realtimeEventsBus'
import { buildRealtimeEventsUrl, buildRealtimeNamespaceUrl } from './realtimeUrl'

export { buildRealtimeEventsUrl }

const createSocket = (namespace, token, tenant) => {
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

  if (enableLedger && debouncedLedger) {
    const ledgerSocket = createSocket('/ledger', token, tenantKey)
    ledgerSocket.on('connect', () => {
      ledgerSocket.emit('subscribe:tenant', tenantKey)
    })
    ledgerSocket.on('ledger:update', debouncedLedger)
    sockets.push({ socket: ledgerSocket, event: 'ledger:update', handler: debouncedLedger })
  }

  if (enableTransactions && debouncedTx) {
    const transactionSocket = createSocket('/transactions', token, tenantKey)
    transactionSocket.on('connect', () => {
      transactionSocket.emit('subscribe:tenant', tenantKey)
    })
    transactionSocket.on('transaction:update', debouncedTx)
    sockets.push({ socket: transactionSocket, event: 'transaction:update', handler: debouncedTx })
  }

  return () => {
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

  const socket = createSocket('/metal-rates', token, tenantKey)

  socket.on('connect', () => {
    socket.emit('subscribe:tenant', tenantKey)
    if (typeof onConnect === 'function') onConnect()
  })

  socket.on('metal-rates:update', onRatesUpdate)

  return () => {
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

  const notificationSocket = createSocket('/notifications', token, tenant)

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

  return () => {
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

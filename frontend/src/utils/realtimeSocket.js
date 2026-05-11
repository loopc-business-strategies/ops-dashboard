import { io } from 'socket.io-client'

const trimApiSuffix = (value) => String(value || '').replace(/\/+$/, '').replace(/\/api$/i, '')

const resolveRealtimeBaseUrl = () => {
  const envBase = trimApiSuffix(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '')
  if (envBase) return envBase
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

const buildNamespaceUrl = (namespace) => {
  const base = resolveRealtimeBaseUrl()
  return base ? `${base}${namespace}` : namespace
}

const createSocket = (namespace, token) => io(buildNamespaceUrl(namespace), {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  auth: {
    token: token || 'browser-session',
    userId: 'erp-client',
  },
})

export const startERPRealtimeFeeds = ({ token, tenant, onLedgerUpdate, onTransactionUpdate }) => {
  const tenantKey = String(tenant || '').trim()
  if (!tenantKey) return () => {}

  const ledgerSocket = createSocket('/ledger', token)
  const transactionSocket = createSocket('/transactions', token)

  ledgerSocket.on('connect', () => {
    ledgerSocket.emit('subscribe:tenant', tenantKey)
  })

  transactionSocket.on('connect', () => {
    transactionSocket.emit('subscribe:tenant', tenantKey)
  })

  if (typeof onLedgerUpdate === 'function') {
    ledgerSocket.on('ledger:update', onLedgerUpdate)
  }

  if (typeof onTransactionUpdate === 'function') {
    transactionSocket.on('transaction:update', onTransactionUpdate)
  }

  return () => {
    if (typeof onLedgerUpdate === 'function') {
      ledgerSocket.off('ledger:update', onLedgerUpdate)
    }
    if (typeof onTransactionUpdate === 'function') {
      transactionSocket.off('transaction:update', onTransactionUpdate)
    }
    ledgerSocket.disconnect()
    transactionSocket.disconnect()
  }
}

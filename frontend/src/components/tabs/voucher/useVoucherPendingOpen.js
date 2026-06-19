import { useEffect } from 'react'
import axios from '../../../api/client'
import { BASE, cfg } from './voucherTabShared'

/**
 * Open a voucher from a notification deep link (web bell → ERP vouchers).
 */
export function useVoucherPendingOpen({
  pendingOpenTransactionId,
  pendingOpenTransactionType,
  onPendingOpenTransactionConsumed,
  canView,
  token,
  enabledVoucherTypes,
  sortVouchers,
  setError,
  setVoucherType,
  setVouchers,
  openVoucherRef,
}) {
  useEffect(() => {
    if (!pendingOpenTransactionId || !pendingOpenTransactionType || typeof onPendingOpenTransactionConsumed !== 'function') {
      return undefined
    }
    if (!canView || !token) {
      onPendingOpenTransactionConsumed()
      return undefined
    }
    const tnorm = String(pendingOpenTransactionType || '').toLowerCase()
    if (!tnorm || !enabledVoucherTypes.includes(tnorm)) {
      setError('This voucher type is not available for your tenant or role.')
      onPendingOpenTransactionConsumed()
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await axios.get(`${BASE}/transactions`, {
          ...cfg(),
          params: { type: tnorm, limit: 200 },
        })
        const txs = sortVouchers(
          (res.data.transactions || []).filter((row) => row.voucherMeta && row.voucherMeta.vocNo),
          tnorm,
        )
        if (cancelled) return
        setVoucherType(tnorm)
        setVouchers(txs)
        const v = txs.find((row) => String(row._id) === String(pendingOpenTransactionId))
        if (v) {
          openVoucherRef.current?.(v)
        } else {
          setError('That voucher was not found in the list. Try opening Vouchers and refreshing.')
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to open voucher from notification')
      } finally {
        if (!cancelled) onPendingOpenTransactionConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    pendingOpenTransactionId,
    pendingOpenTransactionType,
    onPendingOpenTransactionConsumed,
    canView,
    token,
    enabledVoucherTypes,
    sortVouchers,
    setError,
    setVoucherType,
    setVouchers,
    openVoucherRef,
  ])
}

import { useEffect, useRef } from 'react'
import axios from '../../../api/client'
import { BASE, cfg } from './voucherTabShared'

/**
 * Open a voucher from a notification or statement deep link (→ ERP vouchers).
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
  const latestRef = useRef({
    onPendingOpenTransactionConsumed,
    enabledVoucherTypes,
    sortVouchers,
    setError,
    setVoucherType,
    setVouchers,
    openVoucherRef,
  })
  latestRef.current = {
    onPendingOpenTransactionConsumed,
    enabledVoucherTypes,
    sortVouchers,
    setError,
    setVoucherType,
    setVouchers,
    openVoucherRef,
  }

  useEffect(() => {
    const cur = latestRef.current
    if (!pendingOpenTransactionId || !pendingOpenTransactionType || typeof cur.onPendingOpenTransactionConsumed !== 'function') {
      return undefined
    }
    if (!canView || !token) {
      cur.onPendingOpenTransactionConsumed()
      return undefined
    }
    const tnorm = String(pendingOpenTransactionType || '').toLowerCase()
    if (!tnorm || !cur.enabledVoucherTypes.includes(tnorm)) {
      cur.setError('This voucher type is not available for your tenant or role.')
      cur.onPendingOpenTransactionConsumed()
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        latestRef.current.setVoucherType(tnorm)
        let v = null
        try {
          const singleRes = await axios.get(`${BASE}/transactions/${encodeURIComponent(pendingOpenTransactionId)}`, cfg())
          const fetched = singleRes?.data?.transaction || singleRes?.data?.data || singleRes?.data
          if (fetched && String(fetched._id) === String(pendingOpenTransactionId)) {
            v = fetched
          }
        } catch {
          // Fall back to list lookup below.
        }
        if (cancelled) return
        if (!v) {
          const res = await axios.get(`${BASE}/transactions`, {
            ...cfg(),
            params: { type: tnorm, limit: 200 },
          })
          const txs = latestRef.current.sortVouchers(
            (res.data.transactions || []).filter((row) => row.voucherMeta && row.voucherMeta.vocNo),
            tnorm,
          )
          if (cancelled) return
          latestRef.current.setVouchers(txs)
          v = txs.find((row) => String(row._id) === String(pendingOpenTransactionId))
        } else {
          latestRef.current.setVouchers((prev) => (
            prev.some((row) => String(row._id) === String(v._id)) ? prev : [v, ...prev]
          ))
        }
        if (cancelled) return
        if (v) {
          latestRef.current.openVoucherRef.current?.(v)
        } else {
          latestRef.current.setError('That voucher was not found in the list. Try opening Vouchers and refreshing.')
        }
      } catch (e) {
        if (!cancelled) latestRef.current.setError(e.response?.data?.message || 'Failed to open voucher')
      } finally {
        if (!cancelled) latestRef.current.onPendingOpenTransactionConsumed()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    pendingOpenTransactionId,
    pendingOpenTransactionType,
    canView,
    token,
  ])
}

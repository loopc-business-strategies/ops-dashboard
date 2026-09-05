import { useCallback, useEffect, useRef, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { formatDateInputLocal } from './erpTabPresentation'

export function expenseRegisterYearStart() {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

export function cleanExpenseRegisterParams(params = {}) {
  const out = {}
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'paymentSource' && value === 'all') return
    out[key] = value
  })
  return out
}

/**
 * Fetches ERP expense register rows for the dashboard expenses modal.
 */
export function useExpenseRegister({
  token,
  enabled = false,
  startDate = expenseRegisterYearStart(),
  endDate = formatDateInputLocal(new Date()),
  category = '',
  paymentSource = 'all',
  limit = 200,
}) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loadSeqRef = useRef(0)

  const load = useCallback(async () => {
    if (!token || !enabled) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    setError('')
    try {
      const res = await erpAccountingAPI.getExpenseRegister(token, cleanExpenseRegisterParams({
        startDate,
        endDate,
        category,
        paymentSource,
        limit,
      }))
      if (seq !== loadSeqRef.current) return
      setItems(res.items || [])
      setTotal(Number(res.total || 0))
      setCategories(res.categories || [])
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load expense register')
      setItems([])
      setTotal(0)
      setCategories([])
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [token, enabled, startDate, endDate, category, paymentSource, limit])

  useEffect(() => {
    load()
  }, [load])

  return {
    items,
    categories,
    total,
    loading,
    error,
    reload: load,
  }
}

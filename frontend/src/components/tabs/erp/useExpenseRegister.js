import { useCallback, useEffect, useRef, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { formatDateInputLocal } from './erpTabPresentation'

export function expenseRegisterYearStart() {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

let expenseRegisterStarted = false
let expenseRegisterFinished = false
const expenseRegisterStartListeners = new Set()
const expenseRegisterFinishListeners = new Set()

/** True once a dashboard expense-register request has been issued. */
export function hasExpenseRegisterStarted() {
  return expenseRegisterStarted
}

/** True once that expense-register request has settled. */
export function hasExpenseRegisterFinished() {
  return expenseRegisterFinished
}

export function markExpenseRegisterStarted() {
  if (expenseRegisterStarted) return
  expenseRegisterStarted = true
  expenseRegisterStartListeners.forEach((listener) => listener())
}

export function markExpenseRegisterFinished() {
  if (expenseRegisterFinished) return
  expenseRegisterFinished = true
  expenseRegisterFinishListeners.forEach((listener) => listener())
}

export function subscribeExpenseRegisterStarted(listener) {
  expenseRegisterStartListeners.add(listener)
  return () => expenseRegisterStartListeners.delete(listener)
}

export function subscribeExpenseRegisterFinished(listener) {
  expenseRegisterFinishListeners.add(listener)
  return () => expenseRegisterFinishListeners.delete(listener)
}

export function resetExpenseRegisterStarted() {
  expenseRegisterStarted = false
  expenseRegisterFinished = false
}

/**
 * Run `onSettled` after the expense-register request finishes.
 * If that request never starts, run after 1 second. If it hangs, run after 8 seconds.
 */
export function whenExpenseRegisterSettled(onSettled) {
  let settled = false
  let timer = 0
  let unsubStarted = () => {}
  let unsubFinished = () => {}
  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubStarted()
    unsubFinished()
    onSettled()
  }
  const waitForFinish = () => {
    clearTimeout(timer)
    if (hasExpenseRegisterFinished()) {
      timer = setTimeout(finish, 0)
      return
    }
    timer = setTimeout(finish, 8000)
    unsubFinished = subscribeExpenseRegisterFinished(() => {
      clearTimeout(timer)
      timer = setTimeout(finish, 0)
    })
  }
  if (hasExpenseRegisterFinished()) {
    timer = setTimeout(finish, 0)
  } else if (hasExpenseRegisterStarted()) {
    waitForFinish()
  } else {
    timer = setTimeout(finish, 1000)
    unsubStarted = subscribeExpenseRegisterStarted(() => {
      clearTimeout(timer)
      waitForFinish()
    })
  }
  return () => {
    settled = true
    clearTimeout(timer)
    unsubStarted()
    unsubFinished()
  }
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
    markExpenseRegisterStarted()
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
      if (seq === loadSeqRef.current) {
        setLoading(false)
        markExpenseRegisterFinished()
      }
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

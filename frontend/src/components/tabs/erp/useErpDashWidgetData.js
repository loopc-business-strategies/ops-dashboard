import { useCallback, useEffect, useRef, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import messagesAPI from '../../../api/messages'
import { formatDateInputLocal } from './erpTabPresentation'

const reportSoftCache = new Map()

function reportCacheKey(tenant, from, to) {
  return `${tenant || '_'}|${from}|${to}`
}

/**
 * Fetches ERP dashboard report payload and latest chat messages for dashboard widgets.
 * Report and chat load independently so neither waits on the other.
 */
export function useErpDashWidgetData({
  activeTab,
  token,
  canLoadDashboard,
  setError,
  tenantKey = '',
}) {
  const [dashDateFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dashDateTo] = useState(() => formatDateInputLocal(new Date()))
  const [dashAutoRefresh] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [dashChatMessages, setDashChatMessages] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const reportSeqRef = useRef(0)
  const chatSeqRef = useRef(0)

  const loadDashboardReport = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    const seq = ++reportSeqRef.current
    const key = reportCacheKey(tenantKey, dashDateFrom, dashDateTo)
    const soft = reportSoftCache.get(key)
    if (soft) {
      setDashboard(soft)
      setDashboardLoading(false)
    } else {
      setDashboardLoading(true)
    }
    try {
      const data = await erpAccountingAPI.getDashboardReport(token, {
        startDate: dashDateFrom,
        endDate: dashDateTo,
      })
      if (seq !== reportSeqRef.current) return
      reportSoftCache.set(key, data)
      setDashboard(data)
      setError('')
    } catch (e) {
      if (seq !== reportSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load dashboard')
    } finally {
      if (seq === reportSeqRef.current) setDashboardLoading(false)
    }
  }, [canLoadDashboard, token, dashDateFrom, dashDateTo, setError, tenantKey])

  const loadDashChat = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    const seq = ++chatSeqRef.current
    try {
      const chatData = await messagesAPI.getLatestMessages(token, 'group', 10).catch(() => ({ messages: [] }))
      if (seq !== chatSeqRef.current) return
      setDashChatMessages(chatData?.messages || chatData || [])
    } catch {
      if (seq !== chatSeqRef.current) return
      setDashChatMessages([])
    }
  }, [canLoadDashboard, token])

  /** Kick report + chat independently; do not await a joined Promise.all. */
  const loadDashboard = useCallback(() => {
    void loadDashboardReport()
    void loadDashChat()
  }, [loadDashboardReport, loadDashChat])

  useEffect(() => {
    if (activeTab !== 'dashboard' || !canLoadDashboard || !token) return
    void loadDashboardReport()
    void loadDashChat()
  }, [activeTab, dashDateFrom, dashDateTo, token, canLoadDashboard, loadDashboardReport, loadDashChat])

  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return undefined
    const interval = setInterval(() => {
      if (canLoadDashboard && token) {
        void loadDashboardReport()
        void loadDashChat()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [dashAutoRefresh, activeTab, canLoadDashboard, token, loadDashboardReport, loadDashChat])

  return {
    dashboard,
    dashChatMessages,
    dashboardLoading,
    dashDateFrom,
    dashDateTo,
    dashAutoRefresh,
    loadDashboard,
    loadDashboardReport,
  }
}

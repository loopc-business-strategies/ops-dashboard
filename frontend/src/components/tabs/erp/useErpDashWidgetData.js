import { useCallback, useEffect, useRef, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import messagesAPI from '../../../api/messages'
import { formatDateInputLocal } from './erpTabPresentation'

const reportSoftCache = new Map()

function reportCacheKey(from, to) {
  return `${from}|${to}`
}

/**
 * Fetches ERP dashboard report payload and latest chat messages for dashboard widgets.
 * Report and chat load independently so chat latency does not block the report spinner.
 */
export function useErpDashWidgetData({
  activeTab,
  token,
  canLoadDashboard,
  setError,
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
  const loadSeqRef = useRef(0)

  const loadDashboardReport = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    const seq = ++loadSeqRef.current
    const key = reportCacheKey(dashDateFrom, dashDateTo)
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
      if (seq !== loadSeqRef.current) return
      reportSoftCache.set(key, data)
      setDashboard(data)
      setError('')
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load dashboard')
    } finally {
      if (seq === loadSeqRef.current) setDashboardLoading(false)
    }
  }, [canLoadDashboard, token, dashDateFrom, dashDateTo, setError])

  const loadDashChat = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    const seq = loadSeqRef.current
    try {
      const chatData = await messagesAPI.getLatestMessages(token, 'group', 10).catch(() => ({ messages: [] }))
      if (seq !== loadSeqRef.current) return
      setDashChatMessages(chatData?.messages || chatData || [])
    } catch {
      if (seq !== loadSeqRef.current) return
      setDashChatMessages([])
    }
  }, [canLoadDashboard, token])

  const loadDashboard = useCallback(async () => {
    await Promise.all([loadDashboardReport(), loadDashChat()])
  }, [loadDashboardReport, loadDashChat])

  useEffect(() => {
    if (activeTab !== 'dashboard' || !canLoadDashboard || !token) return
    loadDashboardReport()
    loadDashChat()
  }, [activeTab, dashDateFrom, dashDateTo, token, canLoadDashboard, loadDashboardReport, loadDashChat])

  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return undefined
    const interval = setInterval(() => {
      if (canLoadDashboard && token) {
        loadDashboardReport()
        loadDashChat()
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
  }
}

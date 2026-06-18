import { useCallback, useEffect, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import messagesAPI from '../../../api/messages'
import { formatDateInputLocal } from './erpTabPresentation'

/**
 * Fetches ERP dashboard report payload and latest chat messages for dashboard widgets.
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

  const loadDashboard = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    setDashboardLoading(true)
    try {
      const [data, chatData] = await Promise.all([
        erpAccountingAPI.getDashboardReport(token, { startDate: dashDateFrom, endDate: dashDateTo }),
        messagesAPI.getLatestMessages(token, 'group', 10).catch(() => ({ messages: [] })),
      ])
      setDashboard(data)
      setDashChatMessages(chatData?.messages || chatData || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load dashboard')
    } finally {
      setDashboardLoading(false)
    }
  }, [canLoadDashboard, token, dashDateFrom, dashDateTo, setError])

  useEffect(() => {
    if (activeTab !== 'dashboard' || !canLoadDashboard || !token) return
    loadDashboard()
  }, [activeTab, dashDateFrom, dashDateTo, token, canLoadDashboard, loadDashboard])

  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return undefined
    const interval = setInterval(() => {
      if (canLoadDashboard && token) loadDashboard()
    }, 30000)
    return () => clearInterval(interval)
  }, [dashAutoRefresh, activeTab, canLoadDashboard, token, loadDashboard])

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

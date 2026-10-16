import { useCallback, useEffect, useRef, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import messagesAPI from '../../../api/messages'
import { formatDateInputLocal } from './erpTabPresentation'
import { holdLiveMetalRatesForDashboardReport, keepLiveMetalRatesHeld, releaseLiveMetalRates } from '../../../utils/liveMetalRates'
import { whenExpenseRegisterSettled } from './useExpenseRegister'

const reportSoftCache = new Map()
const REPORT_SOFT_TTL_MS = 90 * 1000

function reportCacheKey(tenant, from, to) {
  return `${tenant || '_'}|${from}|${to}`
}

function readReportSoftCache(key) {
  const row = reportSoftCache.get(key)
  if (!row) return null
  if (Date.now() - Number(row.savedAt || 0) > REPORT_SOFT_TTL_MS) {
    reportSoftCache.delete(key)
    return null
  }
  return row.data
}

/**
 * Fetches the ERP dashboard report, then the latest chat messages.
 * Chat waits so it does not share the connection with the cash figures.
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
  const [dashboardReportSettled, setDashboardReportSettled] = useState(false)
  const reportSeqRef = useRef(0)
  const chatSeqRef = useRef(0)
  const chatStartedRef = useRef(false)
  const seenChatTokenRef = useRef(token)
  if (seenChatTokenRef.current !== token) {
    seenChatTokenRef.current = token
    chatStartedRef.current = false
  }

  const loadDashChat = useCallback(async ({ force = false } = {}) => {
    if (!canLoadDashboard || !token) return
    if (!force && chatStartedRef.current) return
    chatStartedRef.current = true
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

  const loadDashboardReport = useCallback(async () => {
    if (!canLoadDashboard || !token) return
    const seq = ++reportSeqRef.current
    const metalHold = holdLiveMetalRatesForDashboardReport()
    const key = reportCacheKey(tenantKey, dashDateFrom, dashDateTo)
    const soft = readReportSoftCache(key)
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
      reportSoftCache.set(key, { data, savedAt: Date.now() })
      setDashboard(data)
      setError('')
    } catch (e) {
      if (seq !== reportSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load dashboard')
    } finally {
      if (seq === reportSeqRef.current) {
        setDashboardLoading(false)
        setDashboardReportSettled(true)
        keepLiveMetalRatesHeld(metalHold)
        cancelAfterExpenseRef.current()
        cancelAfterExpenseRef.current = whenExpenseRegisterSettled(() => {
          releaseLiveMetalRates(metalHold)
          void loadDashChat()
        })
      }
    }
  }, [canLoadDashboard, token, dashDateFrom, dashDateTo, setError, tenantKey, loadDashChat])

  /** Chat and the price connections wait until the expense list has arrived. */
  const loadDashboard = useCallback(() => {
    void Promise.resolve(loadDashboardReport()).then(() => {
      whenExpenseRegisterSettled(() => {
        void loadDashChat({ force: true })
      })
    })
  }, [loadDashboardReport, loadDashChat])

  const dashFetchedRef = useRef({ key: '', at: 0 })
  const cancelAfterExpenseRef = useRef(() => {})

  useEffect(() => {
    if (activeTab !== 'dashboard' || !canLoadDashboard || !token) return
    const key = `${dashDateFrom}|${dashDateTo}`
    if (dashFetchedRef.current.key === key && Date.now() - dashFetchedRef.current.at < 45_000) return
    dashFetchedRef.current = { key, at: Date.now() }
    void loadDashboardReport()
  }, [activeTab, dashDateFrom, dashDateTo, token, canLoadDashboard, loadDashboardReport])

  useEffect(() => {
    if (dashboardReportSettled || !token || !canLoadDashboard) return undefined
    const timer = window.setTimeout(() => {
      setDashboardReportSettled(true)
      if (activeTab === 'dashboard') void loadDashChat()
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [dashboardReportSettled, token, canLoadDashboard, activeTab, loadDashChat])

  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return undefined
    const interval = setInterval(() => {
      if (canLoadDashboard && token) {
        void loadDashboard()
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [dashAutoRefresh, activeTab, canLoadDashboard, token, loadDashboard])

  return {
    dashboard,
    dashChatMessages,
    dashboardLoading,
    dashboardReportSettled,
    dashDateFrom,
    dashDateTo,
    dashAutoRefresh,
    loadDashboard,
    loadDashboardReport,
  }
}

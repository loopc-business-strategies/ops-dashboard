import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

/** Paginate vendors until all rows are merged (used by transactions + vendor tab). */
export async function fetchAllVendorsAggregated(token, baseFilters = {}) {
  const pageSize = 100
  let page = 1
  let total = Number.POSITIVE_INFINITY
  let merged = []
  let permissions = { canManage: false, canUpdateOperational: false }
  while (merged.length < total) {
    const data = await erpAccountingAPI.getVendors(token, { ...baseFilters, page, limit: pageSize })
    const rows = data.vendors || []
    merged = merged.concat(rows)
    total = Number(data.total || merged.length)
    permissions = data.permissions || permissions
    if (!rows.length) break
    page += 1
  }
  const uniqueById = new Map()
  merged.forEach((item) => {
    if (item?._id) uniqueById.set(item._id, item)
  })
  const vendors = Array.from(uniqueById.values())
  const summaryTotals = vendors.reduce((acc, row) => {
    acc.count += 1
    acc.outstanding += Number(row.outstanding || 0)
    acc.overLimit += row.isOverLimit ? 1 : 0
    acc.blacklisted += row.status === 'blacklisted' ? 1 : 0
    acc.onHold += row.status === 'on_hold' ? 1 : 0
    acc.nonCompliant += row.compliance?.compliant ? 0 : 1
    return acc
  }, { count: 0, outstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
  return {
    vendors,
    permissions,
    summary: {
      totalVendors: summaryTotals.count,
      totalOutstanding: Number(summaryTotals.outstanding.toFixed(2)),
      overLimit: summaryTotals.overLimit,
      blacklisted: summaryTotals.blacklisted,
      onHold: summaryTotals.onHold,
      nonCompliant: summaryTotals.nonCompliant,
    },
  }
}

export function useErpVendors({
  token,
  canLoadParties,
  setLoading,
  setVendors,
  setVendorSummary,
  setVendorPermissions,
  setSelectedVendorDetails,
  setVendorPaymentCalendar,
  setVendorComplianceSummary,
  setVendorOverdueQueue,
  setError,
}) {
  const loadVendors = useCallback(async (filters = {}) => {
    if (!canLoadParties) return
    setLoading(true)
    try {
      const data = await fetchAllVendorsAggregated(token, filters)
      setVendors(data.vendors || [])
      setVendorSummary(data.summary || { totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
      setVendorPermissions(data.permissions || { canManage: false, canUpdateOperational: false })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendors')
    }
    setLoading(false)
  }, [token, canLoadParties, setLoading, setVendors, setVendorSummary, setVendorPermissions, setError])

  const loadVendorDetails = useCallback(async (id) => {
    if (!id) {
      setSelectedVendorDetails(null)
      return
    }
    try {
      const data = await erpAccountingAPI.getVendorDetails(token, id)
      setSelectedVendorDetails(data)
      if (data.permissions) setVendorPermissions(data.permissions)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor details')
    }
  }, [token, setSelectedVendorDetails, setVendorPermissions, setError])

  const loadVendorPaymentCalendar = useCallback(async () => {
    try {
      const data = await erpAccountingAPI.getVendorPaymentCalendar(token, { horizonDays: 45 })
      setVendorPaymentCalendar({ rows: data.rows || [], alerts: data.alerts || { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 } })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor payment calendar')
    }
  }, [token, setVendorPaymentCalendar, setError])

  const loadVendorComplianceSummary = useCallback(async () => {
    try {
      const data = await erpAccountingAPI.getVendorComplianceSummary(token)
      setVendorComplianceSummary({
        summary: data.summary || { total: 0, nonCompliant: 0, avgComplianceScore: 0 },
        expiryBuckets: data.expiryBuckets || { expired: 0, warning30: 0, warning60: 0, warning90: 0 },
        atRisk: data.atRisk || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor compliance summary')
    }
  }, [token, setVendorComplianceSummary, setError])

  const loadVendorOverdueQueue = useCallback(async () => {
    try {
      const data = await erpAccountingAPI.getVendorOverdueAlertQueue(token, { horizonDays: 120 })
      setVendorOverdueQueue({
        summary: data.summary || { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 },
        queue: data.queue || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load overdue alert queue')
    }
  }, [token, setVendorOverdueQueue, setError])

  return {
    loadVendors,
    loadVendorDetails,
    loadVendorPaymentCalendar,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
  }
}

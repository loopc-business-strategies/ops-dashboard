import { useCallback, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { downloadXlsxRows } from './exportHelpers'
import {
  aggregateExpensesByMonth,
  buildMomRowsFromTrend,
  buildMomSummaryRows,
  expenseMonthDateRange,
  expenseMonthLabel,
} from './expenseMonthFilterUtils'
import { buildExpenseMomExportPayload, buildExpenseMonthExportPayload } from './expenseExportHelpers'
import { cleanExpenseRegisterParams } from './useExpenseRegister'

export function useExpenseRegisterExports({
  token,
  year,
  month,
  startDate,
  endDate,
  categoryFilter,
  paymentFilter,
  monthlyTrend = [],
}) {
  const [exportBusy, setExportBusy] = useState(false)

  const fetchRegister = useCallback(async (rangeStart, rangeEnd, limit = 500) => {
    const res = await erpAccountingAPI.getExpenseRegister(token, cleanExpenseRegisterParams({
      startDate: rangeStart,
      endDate: rangeEnd,
      category: categoryFilter,
      paymentSource: paymentFilter,
      limit,
    }))
    return res
  }, [token, categoryFilter, paymentFilter])

  const handleDownloadMonth = useCallback(async () => {
    if (!token || exportBusy) return
    setExportBusy(true)
    try {
      const range = month === ''
        ? { startDate, endDate }
        : expenseMonthDateRange(year, month)

      const res = await fetchRegister(range.startDate, range.endDate)
      const items = res.items || []
      const total = Number(res.total || 0)

      if (items.length === 0) {
        window.alert(month === ''
          ? 'No expenses found for the selected period.'
          : 'No expenses found for the selected month.')
        return
      }

      const payload = buildExpenseMonthExportPayload({
        items,
        year,
        monthIndex: month,
        filters: { paymentSource: paymentFilter, category: categoryFilter },
      })
      await downloadXlsxRows(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)

      if (total > items.length) {
        window.alert(`Exported ${items.length} of ${total} entries (API limit). Narrow filters or contact admin for a full export.`)
      }
    } catch (e) {
      window.alert(e.response?.data?.message || e.message || 'Failed to export month report')
    } finally {
      setExportBusy(false)
    }
  }, [
    token,
    exportBusy,
    year,
    month,
    startDate,
    endDate,
    paymentFilter,
    categoryFilter,
    fetchRegister,
  ])

  const handleDownloadMom = useCallback(async () => {
    if (!token || exportBusy) return
    setExportBusy(true)
    try {
      const yearEnd = expenseMonthDateRange(year, '').endDate
      const res = await fetchRegister(`${year}-01-01`, yearEnd, 500)
      const items = res.items || []
      const total = Number(res.total || 0)

      let buckets = aggregateExpensesByMonth(items, year)
      if (items.length === 0 && monthlyTrend.length > 0) {
        buckets = buildMomRowsFromTrend(monthlyTrend, year)
      }

      const monthRows = buildMomSummaryRows(buckets)
      const payload = buildExpenseMomExportPayload({ year, monthRows })
      await downloadXlsxRows(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)

      if (total > items.length) {
        window.alert(`MoM summary may be incomplete: only ${items.length} of ${total} year entries were loaded.`)
      }
    } catch (e) {
      window.alert(e.response?.data?.message || e.message || 'Failed to export month-on-month report')
    } finally {
      setExportBusy(false)
    }
  }, [token, exportBusy, year, monthlyTrend, fetchRegister])

  return {
    exportBusy,
    handleDownloadMonth,
    handleDownloadMom,
    expenseMonthLabel: expenseMonthLabel(month),
  }
}

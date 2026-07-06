import { useCallback, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { downloadXlsxSheets } from './exportHelpers'
import {
  aggregateExpensesByMonth,
  buildMomRowsFromTrend,
  buildMomSummaryRows,
  expenseMonthDateRange,
  expenseMonthLabel,
} from './expenseMonthFilterUtils'
import {
  buildExpenseMomExportPayload,
  buildExpenseMonthExportPayload,
  buildExpenseMonthlyReportsFileBase,
} from './expenseExportHelpers'
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

  const handleDownloadMonthlyReports = useCallback(async () => {
    if (!token || exportBusy) return
    setExportBusy(true)
    try {
      const detailRange = { startDate, endDate }
      const yearEnd = expenseMonthDateRange(year, '').endDate

      const [detailRes, yearRes] = await Promise.all([
        fetchRegister(detailRange.startDate, detailRange.endDate),
        fetchRegister(`${year}-01-01`, yearEnd),
      ])

      const detailItems = detailRes.items || []
      const detailTotal = Number(detailRes.total || 0)
      const yearItems = yearRes.items || []
      const yearTotal = Number(yearRes.total || 0)

      let buckets = aggregateExpensesByMonth(yearItems, year)
      if (yearItems.length === 0 && monthlyTrend.length > 0) {
        buckets = buildMomRowsFromTrend(monthlyTrend, year)
      }
      const monthRows = buildMomSummaryRows(buckets)

      if (detailItems.length === 0 && monthRows.every((row) => !row.total)) {
        window.alert('No expenses found for the selected filters.')
        return
      }

      const detailPayload = buildExpenseMonthExportPayload({
        items: detailItems,
        year,
        monthIndex: month,
        filters: {
          paymentSource: paymentFilter,
          category: categoryFilter,
          startDate,
          endDate,
        },
      })
      const momPayload = buildExpenseMomExportPayload({
        year,
        monthRows,
        filters: {
          paymentSource: paymentFilter,
          category: categoryFilter,
        },
      })

      const fileBase = buildExpenseMonthlyReportsFileBase({ year, monthIndex: month })
      await downloadXlsxSheets([
        { rows: detailPayload.rows, sheetName: detailPayload.sheetName },
        { rows: momPayload.rows, sheetName: momPayload.sheetName },
      ], `${fileBase}.xlsx`)

      const warnings = []
      if (detailTotal > detailItems.length) {
        warnings.push(`Detail sheet: exported ${detailItems.length} of ${detailTotal} entries.`)
      }
      if (yearTotal > yearItems.length) {
        warnings.push(`MoM summary may be incomplete: ${yearItems.length} of ${yearTotal} year entries loaded.`)
      }
      if (warnings.length) {
        window.alert(warnings.join('\n'))
      }
    } catch (e) {
      window.alert(e.response?.data?.message || e.message || 'Failed to download monthly reports')
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
    monthlyTrend,
    fetchRegister,
  ])

  return {
    exportBusy,
    handleDownloadMonthlyReports,
    expenseMonthLabel: expenseMonthLabel(month),
  }
}

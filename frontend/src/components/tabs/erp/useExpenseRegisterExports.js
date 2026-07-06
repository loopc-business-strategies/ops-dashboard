import { useCallback, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { expenseMonthLabel } from './expenseMonthFilterUtils'
import { buildExpensePdfMeta } from './expenseExportHelpers'
import { exportExpenseRegisterPdf } from './expensePrintExport'
import { cleanExpenseRegisterParams } from './useExpenseRegister'

export function useExpenseRegisterExports({
  token,
  year,
  month,
  startDate,
  endDate,
  categoryFilter,
  paymentFilter,
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
      const res = await fetchRegister(startDate, endDate)
      const items = res.items || []
      const total = Number(res.total || 0)

      if (items.length === 0) {
        window.alert('No expenses found for the selected filters.')
        return
      }

      const totalAmount = items.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      const meta = buildExpensePdfMeta({
        year,
        monthIndex: month,
        filters: {
          paymentSource: paymentFilter,
          category: categoryFilter,
          startDate,
          endDate,
        },
        total,
        exportedCount: items.length,
        totalAmount,
      })

      await exportExpenseRegisterPdf({
        items,
        meta,
        year,
        monthIndex: month,
      })

      if (total > items.length) {
        window.alert(`Exported ${items.length} of ${total} entries (API limit). Narrow filters for a complete export.`)
      }
    } catch (e) {
      window.alert(e.response?.data?.message || e.message || 'Failed to download expense report PDF')
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

  return {
    exportBusy,
    handleDownloadMonthlyReports,
    expenseMonthLabel: expenseMonthLabel(month),
  }
}

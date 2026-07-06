import { useCallback, useEffect, useState } from 'react'
import {
  currentExpenseMonthIndex,
  currentExpenseYear,
  expenseMonthDateRange,
} from './expenseMonthFilterUtils'

/**
 * Shared year/month filter with synced register date range.
 */
export function useExpensePeriodFilter({
  defaultYear = currentExpenseYear(),
  defaultMonth = 'current',
} = {}) {
  const initialMonth = defaultMonth === 'current' ? currentExpenseMonthIndex() : String(defaultMonth ?? '')
  const initialRange = expenseMonthDateRange(defaultYear, initialMonth)

  const [year, setYearState] = useState(String(defaultYear))
  const [month, setMonthState] = useState(initialMonth)
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)

  useEffect(() => {
    const range = expenseMonthDateRange(year, month)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }, [year, month])

  const setYear = useCallback((nextYear) => {
    setYearState(String(nextYear))
  }, [])

  const setMonth = useCallback((nextMonth) => {
    setMonthState(nextMonth === '' ? '' : String(nextMonth))
  }, [])

  return {
    year,
    month,
    startDate,
    endDate,
    setYear,
    setMonth,
    setStartDate,
    setEndDate,
  }
}

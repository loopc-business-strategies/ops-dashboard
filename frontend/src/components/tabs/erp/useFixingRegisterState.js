import { useState } from 'react'
import { formatDateInputLocal } from './erpTabPresentation'
import { loadFixingRegisterData } from './fixingRegisterDataLoader'

export function createDefaultFixingRegFilter() {
  return {
    metalType: '',
    quantityUnit: 'GOZ',
    rateUnit: 'GOZ',
    orderBy: 'voucherNo',
    fromDate: formatDateInputLocal(new Date(new Date().getFullYear(), 0, 1)),
    toDate: formatDateInputLocal(new Date()),
    groupBy: 'none',
    partyFilter: 'all',
    partySearch: '',
    excludeOpeningBalance: false,
    excludeFutures: false,
    status: 'preview',
  }
}

/** Filter, results, and load handler for the fixing register tab. */
export function useFixingRegisterState({ token }) {
  const [fixingRegFilter, setFixingRegFilter] = useState(createDefaultFixingRegFilter)
  const [fixingRegResults, setFixingRegResults] = useState([])
  const [fixingRegOpening, setFixingRegOpening] = useState({ qtyOz: 0, value: 0 })
  const [fixingRegLoading, setFixingRegLoading] = useState(false)
  const [fixingRegShown, setFixingRegShown] = useState(false)
  const [fixingRegError, setFixingRegError] = useState('')

  const handleFixingRegProceed = async () => {
    setFixingRegError('')
    setFixingRegLoading(true)
    try {
      const { rows, opening } = await loadFixingRegisterData({ token, fixingRegFilter })
      setFixingRegOpening(opening)
      setFixingRegResults(rows)
      setFixingRegShown(true)
    } catch (err) {
      setFixingRegError(err?.response?.data?.message || err.message || 'Failed to load fixing register data.')
    } finally {
      setFixingRegLoading(false)
    }
  }

  return {
    fixingRegFilter,
    setFixingRegFilter,
    fixingRegResults,
    setFixingRegResults,
    fixingRegOpening,
    fixingRegLoading,
    fixingRegShown,
    setFixingRegShown,
    fixingRegError,
    setFixingRegError,
    handleFixingRegProceed,
  }
}

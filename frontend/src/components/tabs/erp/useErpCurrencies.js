import { useCallback, useRef } from 'react'
import { loadSharedCurrencies } from '../../../utils/erpSharedCurrencies'

export function useErpCurrencies({
  token,
  canLoadReferenceData,
  setLoading,
  setCurrencies,
  setError,
}) {
  const loadSeqRef = useRef(0)

  const loadCurrencies = useCallback(async () => {
    if (!canLoadReferenceData) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const data = await loadSharedCurrencies(token)
      if (seq !== loadSeqRef.current) return
      setCurrencies(data.currencies || [])
      setError('')
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load currencies')
    }
    if (seq === loadSeqRef.current) setLoading(false)
  }, [token, canLoadReferenceData, setLoading, setCurrencies, setError])

  return { loadCurrencies }
}

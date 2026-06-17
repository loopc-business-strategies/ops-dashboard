import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'

export function useErpMappings({
  token,
  canViewMappings,
  canLoadReferenceData,
  setLoading,
  setMappings,
  setMappingSummary,
  setAccounts,
  setError,
}) {
  const loadMappings = useCallback(async (params = {}) => {
    if (!canViewMappings) return
    setLoading(true)
    try {
      const [mappingData, accountData] = await Promise.all([
        erpAccountingAPI.getMappings(token, params),
        canLoadReferenceData ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
      ])
      setMappings(mappingData.mappings || [])
      setMappingSummary(mappingData.summary || { total: 0, shared: 0, byDepartment: {} })
      if (accountData) setAccounts(accountData.accounts || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load mappings')
    }
    setLoading(false)
  }, [
    token,
    canViewMappings,
    canLoadReferenceData,
    setLoading,
    setMappings,
    setMappingSummary,
    setAccounts,
    setError,
  ])

  return { loadMappings }
}

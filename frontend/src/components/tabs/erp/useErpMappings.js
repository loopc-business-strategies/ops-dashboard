import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchCatalogCached, CATALOG_KINDS } from '../../../utils/erpCatalogCache'

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
  const loadSeqRef = useRef(0)

  const loadMappings = useCallback(async (params = {}) => {
    if (!canViewMappings) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const [mappingData, accountData] = await Promise.all([
        fetchCatalogCached(CATALOG_KINDS.mappings, token, params || {}, () =>
          erpAccountingAPI.getMappings(token, params)),
        canLoadReferenceData
          ? fetchCatalogCached(CATALOG_KINDS.accounts, token, { page: 1, limit: 5000 }, () =>
            erpAccountingAPI.getAccounts(token, { page: 1, limit: 5000 }))
          : Promise.resolve(null),
      ])
      if (seq !== loadSeqRef.current) return
      setMappings(mappingData.mappings || [])
      setMappingSummary(mappingData.summary || { total: 0, shared: 0, byDepartment: {} })
      if (accountData) setAccounts(accountData.accounts || [])
      setError('')
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load mappings')
    }
    if (seq === loadSeqRef.current) setLoading(false)
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

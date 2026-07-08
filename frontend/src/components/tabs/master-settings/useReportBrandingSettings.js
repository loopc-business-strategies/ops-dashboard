import { useCallback, useEffect, useState } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import {
  DEFAULT_BRANDING,
  clampBrandingDimension,
  normalizeBrandingKey,
  normalizeStatementPrint,
  normalizeVoucherPrint,
} from '../erp/ERPBrandingUtils'

const mergeBranding = (branding = {}) => ({
  ...DEFAULT_BRANDING,
  ...branding,
  voucherPrint: normalizeVoucherPrint(branding.voucherPrint),
  statementPrint: normalizeStatementPrint(branding.statementPrint),
})

export function useReportBrandingSettings({ token, enabled = true }) {
  const [branding, setBranding] = useState(() => mergeBranding())
  const [loading, setLoading] = useState(Boolean(enabled))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    if (!enabled || !token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await erpAccountingAPI.getReportBranding(token, { key: 'default' })
      setBranding(mergeBranding(data.branding))
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load branding settings')
    } finally {
      setLoading(false)
    }
  }, [enabled, token])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async (partial = {}) => {
    if (!token) return false
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const payload = {
        ...branding,
        ...partial,
        key: normalizeBrandingKey(branding.key || DEFAULT_BRANDING.key),
        logoWidth: clampBrandingDimension(
          partial.logoWidth ?? branding.logoWidth,
          DEFAULT_BRANDING.logoWidth,
          80,
          260,
        ),
        logoHeight: clampBrandingDimension(
          partial.logoHeight ?? branding.logoHeight,
          DEFAULT_BRANDING.logoHeight,
          32,
          120,
        ),
        voucherPrint: normalizeVoucherPrint({
          ...branding.voucherPrint,
          ...(partial.voucherPrint || {}),
        }),
        statementPrint: normalizeStatementPrint({
          ...branding.statementPrint,
          ...(partial.statementPrint || {}),
        }),
      }
      const data = await erpAccountingAPI.updateReportBranding(token, payload)
      const next = mergeBranding(data.branding)
      setBranding(next)
      setStatus('Saved')
      return true
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save branding settings')
      return false
    } finally {
      setSaving(false)
    }
  }, [token, branding])

  const updateBranding = useCallback((updater) => {
    setBranding((prev) => {
      const patch = typeof updater === 'function' ? updater(prev) : updater
      return mergeBranding({ ...prev, ...patch })
    })
    setStatus('')
  }, [])

  return {
    branding,
    setBranding: updateBranding,
    loading,
    saving,
    error,
    status,
    load,
    save,
  }
}

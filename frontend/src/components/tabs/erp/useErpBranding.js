import { useCallback, useEffect, useMemo } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  LOGO_UPLOAD_MAX_BYTES,
  clampBrandingDimension,
  createLogoRenderAsset,
  isSupportedLogoUpload,
  normalizeBrandingKey,
} from './ERPBrandingUtils'

export function useErpBranding({
  token,
  selectedBrandingKey,
  brandingForm,
  setBrandingProfiles,
  setSelectedBrandingKey,
  setReportBranding,
  setBrandingForm,
  setBrandingPreviewLogo,
  setSaving,
  setError,
  showNotification,
}) {
  const loadReportBranding = useCallback(async (brandingKey = selectedBrandingKey || DEFAULT_BRANDING.key) => {
    try {
      const data = await erpAccountingAPI.getReportBranding(token, { key: brandingKey })
      const branding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || branding.key || DEFAULT_BRANDING.key)
      setReportBranding(branding)
      setBrandingForm(branding)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report branding')
    }
  }, [
    token,
    selectedBrandingKey,
    setBrandingProfiles,
    setSelectedBrandingKey,
    setReportBranding,
    setBrandingForm,
    setError,
  ])

  const handleBrandingLogoFile = useCallback(async (file) => {
    if (!file) return
    if (!isSupportedLogoUpload(file)) {
      setError('Logo upload supports PNG, SVG, JPEG, and WebP files.')
      return
    }
    if (Number(file.size || 0) > LOGO_UPLOAD_MAX_BYTES) {
      setError('Logo file is too large. Please upload an image up to 3 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setBrandingForm((prev) => ({ ...prev, logoUrl: String(reader.result || '') }))
      setError('')
    }
    reader.readAsDataURL(file)
  }, [setBrandingForm, setError])

  const handleSaveBranding = useCallback(async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        ...brandingForm,
        key: normalizeBrandingKey(brandingForm.key || selectedBrandingKey || DEFAULT_BRANDING.key),
        logoWidth: clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260),
        logoHeight: clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120),
      }
      const data = await erpAccountingAPI.updateReportBranding(token, payload)
      const nextBranding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || nextBranding.key || DEFAULT_BRANDING.key)
      setReportBranding(nextBranding)
      setBrandingForm(nextBranding)
      setError('')
      showNotification('✅ Report branding saved')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save report branding')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    brandingForm,
    selectedBrandingKey,
    setSaving,
    setBrandingProfiles,
    setSelectedBrandingKey,
    setReportBranding,
    setBrandingForm,
    setError,
    showNotification,
  ])

  const handleSelectBrandingProfile = useCallback(async (key) => {
    const nextKey = normalizeBrandingKey(key)
    setSelectedBrandingKey(nextKey)
    await loadReportBranding(nextKey)
  }, [setSelectedBrandingKey, loadReportBranding])

  const handleCreateBrandingDraft = useCallback(() => {
    const timestamp = Date.now().toString().slice(-6)
    const nextDraft = {
      ...DEFAULT_BRANDING,
      key: `entity-${timestamp}`,
      entityName: 'New Entity',
      branchName: '',
      isDefault: false,
    }
    setBrandingProfiles((prev) => [
      ...prev.filter((profile) => profile.key !== nextDraft.key),
      {
        key: nextDraft.key,
        entityName: nextDraft.entityName,
        branchName: nextDraft.branchName,
        companyName: nextDraft.companyName,
        isDefault: false,
      },
    ])
    setSelectedBrandingKey(nextDraft.key)
    setBrandingForm(nextDraft)
  }, [setBrandingProfiles, setSelectedBrandingKey, setBrandingForm])

  useEffect(() => {
    let cancelled = false
    const updatePreviewLogo = async () => {
      if (!brandingForm.logoUrl) {
        setBrandingPreviewLogo('')
        return
      }
      const nextLogo = await createLogoRenderAsset(
        brandingForm.logoUrl,
        brandingForm.logoWidth,
        brandingForm.logoHeight,
        brandingForm.logoFit,
      )
      if (!cancelled) {
        setBrandingPreviewLogo(nextLogo)
      }
    }
    updatePreviewLogo()
    return () => {
      cancelled = true
    }
  }, [brandingForm.logoFit, brandingForm.logoHeight, brandingForm.logoUrl, brandingForm.logoWidth, setBrandingPreviewLogo])

  const brandingPreview = useMemo(
    () => ({ ...DEFAULT_BRANDING, ...brandingForm }),
    [brandingForm],
  )

  return {
    loadReportBranding,
    handleBrandingLogoFile,
    handleSaveBranding,
    handleSelectBrandingProfile,
    handleCreateBrandingDraft,
    brandingPreview,
  }
}

import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { EMPTY_VENDOR_DOCUMENT_FORM, EMPTY_VENDOR_FORM, vendorToFormState } from './vendorFormDefaults'

export function useErpVendorActions({
  token,
  canManageVendors,
  vendorPermissions,
  vendorForm,
  editingVendorId,
  vendorFilters,
  vendorWorkflowReason,
  vendorDocumentForm,
  selectedVendorId,
  setVendorForm,
  setShowVendorForm,
  setEditingVendorId,
  setSelectedVendorId,
  setSelectedVendorDetails,
  setVendorWorkflowReason,
  setVendorDocumentForm,
  setSaving,
  setError,
  showNotification,
  loadVendors,
  loadVendorDetails,
  loadVendorPaymentCalendar,
  loadVendorComplianceSummary,
  loadVendorOverdueQueue,
}) {
  const handleCreateVendor = useCallback(async (e) => {
    e.preventDefault()
    if (!canManageVendors && !editingVendorId) {
      setError('Only Admin/Finance can create vendors')
      return
    }
    if (!vendorForm.name) {
      setError('Vendor name is required')
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...vendorForm,
        openingBalance: Number(vendorForm.openingBalance || 0),
        paymentTermsDays: Number(vendorForm.paymentTermsDays || 30),
        creditLimit: Number(vendorForm.creditLimit || 0),
        rating: Number(vendorForm.rating || 3),
        tags: String(vendorForm.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      }
      if (editingVendorId) {
        await erpAccountingAPI.updateVendor(token, editingVendorId, payload)
        showNotification('✅ Vendor updated')
      } else {
        await erpAccountingAPI.createVendor(token, payload)
        showNotification('✅ Vendor created')
      }
      setVendorForm({ ...EMPTY_VENDOR_FORM })
      setShowVendorForm(false)
      setEditingVendorId('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
      ])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save vendor')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    canManageVendors,
    editingVendorId,
    vendorForm,
    vendorFilters,
    setVendorForm,
    setShowVendorForm,
    setEditingVendorId,
    setSaving,
    setError,
    showNotification,
    loadVendors,
    loadVendorComplianceSummary,
  ])

  const handleVendorFilterSearch = useCallback(async () => {
    await loadVendors(vendorFilters)
  }, [loadVendors, vendorFilters])

  const handleVendorSelect = useCallback(async (vendorId) => {
    setSelectedVendorId(vendorId)
    await loadVendorDetails(vendorId)
  }, [setSelectedVendorId, loadVendorDetails])

  const handleEditVendor = useCallback((vendor) => {
    if (!vendorPermissions.canUpdateOperational) {
      setError('You are not allowed to edit vendors')
      return
    }
    setEditingVendorId(vendor._id)
    setShowVendorForm(true)
    setVendorForm(vendorToFormState(vendor))
  }, [vendorPermissions, setEditingVendorId, setShowVendorForm, setVendorForm, setError])

  const handleDeleteVendor = useCallback(async (vendor) => {
    if (!vendorPermissions.canManage) {
      setError('Only Admin/Finance can deactivate vendors')
      return
    }
    if (!window.confirm(`Deactivate vendor ${vendor.name}?`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendor(token, vendor._id)
      if (selectedVendorId === vendor._id) {
        setSelectedVendorId('')
        setSelectedVendorDetails(null)
      }
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification('✅ Vendor deactivated')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to deactivate vendor')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    vendorPermissions,
    selectedVendorId,
    vendorFilters,
    setSaving,
    setError,
    setSelectedVendorId,
    setSelectedVendorDetails,
    showNotification,
    loadVendors,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
  ])

  const handleVendorWorkflowStatus = useCallback(async (status) => {
    if (!selectedVendorId) return
    try {
      setSaving(true)
      await erpAccountingAPI.updateVendorWorkflow(token, selectedVendorId, {
        status,
        reason: vendorWorkflowReason,
      })
      setVendorWorkflowReason('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorDetails(selectedVendorId),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification(`✅ Vendor moved to ${status}`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update vendor workflow')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    selectedVendorId,
    vendorWorkflowReason,
    vendorFilters,
    setSaving,
    setError,
    setVendorWorkflowReason,
    showNotification,
    loadVendors,
    loadVendorDetails,
    loadVendorPaymentCalendar,
    loadVendorComplianceSummary,
    loadVendorOverdueQueue,
  ])

  const handleAddVendorDocument = useCallback(async (e) => {
    e.preventDefault()
    if (!selectedVendorId) {
      setError('Select a vendor first')
      return
    }
    if (!vendorDocumentForm.title && !vendorDocumentForm.file) {
      setError('Document title is required')
      return
    }
    try {
      setSaving(true)
      if (vendorDocumentForm.file) {
        const { file, ...payload } = vendorDocumentForm
        await erpAccountingAPI.uploadVendorDocument(token, selectedVendorId, {
          ...payload,
          title: payload.title || file.name || 'Vendor attachment',
        }, file)
      } else {
        const { file: _omitFile, ...payload } = vendorDocumentForm
        await erpAccountingAPI.addVendorDocument(token, selectedVendorId, payload)
      }
      setVendorDocumentForm({ ...EMPTY_VENDOR_DOCUMENT_FORM })
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add vendor document')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    selectedVendorId,
    vendorDocumentForm,
    setSaving,
    setError,
    setVendorDocumentForm,
    showNotification,
    loadVendorDetails,
    loadVendorComplianceSummary,
  ])

  const handleVendorTableDocumentUpload = useCallback(async (vendor, file) => {
    if (!vendor?._id || !file) return
    if (!vendorPermissions.canUpdateOperational) {
      setError('You are not allowed to upload vendor documents')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.uploadVendorDocument(token, vendor._id, {
        docType: 'other',
        title: file.name || 'Vendor attachment',
        status: 'active',
        verified: false,
      }, file)
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
        selectedVendorId === vendor._id ? loadVendorDetails(vendor._id) : Promise.resolve(),
      ])
      showNotification('✅ Vendor attachment uploaded')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload vendor attachment')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    vendorPermissions,
    vendorFilters,
    selectedVendorId,
    setSaving,
    setError,
    showNotification,
    loadVendors,
    loadVendorComplianceSummary,
    loadVendorDetails,
  ])

  const handleDeleteVendorDocument = useCallback(async (documentId) => {
    if (!selectedVendorId) return
    if (!window.confirm('Delete this vendor document?')) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendorDocument(token, selectedVendorId, documentId)
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete vendor document')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    selectedVendorId,
    setSaving,
    setError,
    showNotification,
    loadVendorDetails,
    loadVendorComplianceSummary,
  ])

  return {
    handleCreateVendor,
    handleVendorFilterSearch,
    handleVendorSelect,
    handleEditVendor,
    handleDeleteVendor,
    handleVendorWorkflowStatus,
    handleAddVendorDocument,
    handleVendorTableDocumentUpload,
    handleDeleteVendorDocument,
  }
}

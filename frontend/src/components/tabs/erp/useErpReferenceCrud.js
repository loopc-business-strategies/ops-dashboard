import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import {
  EMPTY_CURRENCY_FORM,
  EMPTY_CUSTOMER_FORM,
  EMPTY_MAPPING_FORM,
  buildReferenceEditFormState,
  currencyFormPayload,
  resolveCurrencyExchangeRate,
} from './referenceEditFormDefaults'

export function useErpReferenceCrud({
  token,
  erpBaseCurrencyCode,
  customerForm,
  currencyForm,
  mappingForm,
  editState,
  currencies,
  setCustomerForm,
  setCurrencyForm,
  setMappingForm,
  setShowCustomerForm,
  setShowCurrencyForm,
  setShowMappingForm,
  setEditState,
  setSaving,
  setError,
  showNotification,
  loadCustomers,
  loadAccounts,
  loadCurrencies,
  loadMappings,
  handleSaveEditLedger,
}) {
  const openEditModal = useCallback((type, record) => {
    setEditState({ type, record, form: buildReferenceEditFormState(type, record) })
  }, [setEditState])

  const closeEditModal = useCallback(() => {
    setEditState({ type: '', record: null, form: {} })
  }, [setEditState])

  const handleCreateCustomer = useCallback(async (e) => {
    e.preventDefault()
    if (!customerForm.name) {
      setError('Customer name is required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createCustomer(token, {
        ...customerForm,
        openingBalance: Number(customerForm.openingBalance || 0),
        creditLimit: Number(customerForm.creditLimit || 0),
        paymentTermsDays: Number(customerForm.paymentTermsDays || 0),
      })
      setCustomerForm({
        ...EMPTY_CUSTOMER_FORM,
        currency: currencies.find((currency) => currency.baseCurrency)?.code || 'USD',
      })
      setShowCustomerForm(false)
      await Promise.all([loadCustomers(), loadAccounts()])
      showNotification('✅ Customer created successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    customerForm,
    currencies,
    setCustomerForm,
    setShowCustomerForm,
    setSaving,
    setError,
    showNotification,
    loadCustomers,
    loadAccounts,
  ])

  const handleSaveEdit = useCallback(async (e) => {
    e.preventDefault()
    if (editState.type === 'ledger') {
      handleSaveEditLedger()
      return
    }
    if (!editState.record || !editState.type) return
    setSaving(true)
    try {
      if (editState.type === 'account') {
        await erpAccountingAPI.updateAccount(token, editState.record._id, editState.form)
        await loadAccounts()
      }
      if (editState.type === 'mapping') {
        await erpAccountingAPI.updateMapping(token, editState.record._id, editState.form)
        await loadMappings()
      }
      if (editState.type === 'currency') {
        const { exchangeRate } = resolveCurrencyExchangeRate(editState.form, erpBaseCurrencyCode)
        if (!editState.form.baseCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
          setError(`Enter a positive exchange rate or a valid 1 ${erpBaseCurrencyCode} = (units) quote.`)
          setSaving(false)
          return
        }
        await erpAccountingAPI.updateCurrency(token, editState.record._id, {
          ...currencyFormPayload(editState.form),
          exchangeRate,
        })
        await loadCurrencies()
      }
      if (editState.type === 'customer') {
        await erpAccountingAPI.updateCustomer(token, editState.record._id, {
          ...editState.form,
          creditLimit: Number(editState.form.creditLimit || 0),
          paymentTermsDays: Number(editState.form.paymentTermsDays || 0),
        })
        await loadCustomers()
      }
      closeEditModal()
      showNotification('✅ Changes saved successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    editState,
    erpBaseCurrencyCode,
    setSaving,
    setError,
    showNotification,
    loadAccounts,
    loadMappings,
    loadCurrencies,
    loadCustomers,
    closeEditModal,
    handleSaveEditLedger,
  ])

  const handleCreateCurrency = useCallback(async (e) => {
    e.preventDefault()
    if (!currencyForm.code || !currencyForm.name || !currencyForm.symbol) {
      setError('Currency code, name, and symbol are required')
      return
    }
    const { exchangeRate } = resolveCurrencyExchangeRate(currencyForm, erpBaseCurrencyCode)
    if (!currencyForm.baseCurrency && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      setError(`For a non-base currency, enter a positive exchange rate (${erpBaseCurrencyCode} per 1 unit) or use 1 ${erpBaseCurrencyCode} = (units).`)
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createCurrency(token, { ...currencyFormPayload(currencyForm), exchangeRate })
      setCurrencyForm({ ...EMPTY_CURRENCY_FORM })
      setShowCurrencyForm(false)
      await loadCurrencies()
      showNotification('✅ Currency created successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create currency')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    currencyForm,
    erpBaseCurrencyCode,
    setCurrencyForm,
    setShowCurrencyForm,
    setSaving,
    setError,
    showNotification,
    loadCurrencies,
  ])

  const handleSyncCurrencyMaster = useCallback(async () => {
    setSaving(true)
    try {
      const response = await erpAccountingAPI.seedDefaultCurrencies(token)
      await loadCurrencies()
      showNotification(`✅ Currency master synced (${response.createdCount || 0} created, ${response.normalizedCount || 0} updated)`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to sync currency master')
    } finally {
      setSaving(false)
    }
  }, [token, setSaving, setError, showNotification, loadCurrencies])

  const handleCreateMapping = useCallback(async (e) => {
    e.preventDefault()
    if (!mappingForm.mappingType || !mappingForm.debitAccountId || !mappingForm.creditAccountId) {
      setError('Mapping type, debit account, and credit account are required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createMapping(token, mappingForm)
      setMappingForm({ ...EMPTY_MAPPING_FORM })
      setShowMappingForm(false)
      await loadMappings()
      showNotification('✅ Mapping created successfully')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create mapping')
    } finally {
      setSaving(false)
    }
  }, [
    token,
    mappingForm,
    setMappingForm,
    setShowMappingForm,
    setSaving,
    setError,
    showNotification,
    loadMappings,
  ])

  const handleEditMapping = useCallback((mapping) => openEditModal('mapping', mapping), [openEditModal])
  const handleEditCurrency = useCallback((currency) => openEditModal('currency', currency), [openEditModal])
  const handleEditCustomer = useCallback((customer) => openEditModal('customer', customer), [openEditModal])

  const handleDeleteMapping = useCallback(async (mapping) => {
    if (!window.confirm(`Deactivate mapping ${mapping.mappingType}?`)) return
    try {
      await erpAccountingAPI.deleteMapping(token, mapping._id)
      await loadMappings()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete mapping')
    }
  }, [token, setError, loadMappings])

  const handleDeleteCurrency = useCallback(async (currency) => {
    if (!window.confirm(`Delete currency ${currency.code}?`)) return
    try {
      await erpAccountingAPI.deleteCurrency(token, currency._id)
      await loadCurrencies()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete currency')
    }
  }, [token, setError, loadCurrencies])

  const handleDeleteCustomer = useCallback(async (customer) => {
    if (!window.confirm(`Deactivate customer ${customer.name}?`)) return
    try {
      await erpAccountingAPI.deleteCustomer(token, customer._id)
      await loadCustomers()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete customer')
    }
  }, [token, setError, loadCustomers])

  return {
    openEditModal,
    closeEditModal,
    handleCreateCustomer,
    handleSaveEdit,
    handleCreateCurrency,
    handleSyncCurrencyMaster,
    handleCreateMapping,
    handleEditMapping,
    handleEditCurrency,
    handleEditCustomer,
    handleDeleteMapping,
    handleDeleteCurrency,
    handleDeleteCustomer,
  }
}

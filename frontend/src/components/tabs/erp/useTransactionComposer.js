import { useCallback, useEffect, useState } from 'react'
import { createTransactionForm } from './erpTabUtils'

/**
 * Transaction composer form state, validation, and create/update handler.
 */
export function useTransactionComposer({
  baseCurrencyCode,
  customers,
  vendors,
  currencies,
  token,
  loadTransactionReferenceData,
  loadTransactions,
  setError,
  setSaving,
  setSelectedTransactionId,
  showNotification,
  erpAccountingAPI,
}) {
  const [transactionForm, setTransactionForm] = useState(createTransactionForm)
  const [editingTransactionId, setEditingTransactionId] = useState('')
  const isTransactionEditMode = Boolean(editingTransactionId)

  const resetTransactionComposer = useCallback(() => {
    setEditingTransactionId('')
    setTransactionForm({
      ...createTransactionForm(),
      currency: baseCurrencyCode,
      exchangeRate: '1',
    })
  }, [baseCurrencyCode])

  const populateTransactionForm = useCallback((tx) => {
    void loadTransactionReferenceData()
    setEditingTransactionId(tx._id)
    setSelectedTransactionId(tx._id)
    setTransactionForm({
      type: tx.type || 'expense',
      metalFixStatus: String(tx.voucherMeta?.fixingType || '').toLowerCase().includes('non') ? 'unfixed' : 'fixed',
      amount: String(tx.amount ?? ''),
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      currency: tx.currency || 'USD',
      exchangeRate: String(tx.exchangeRate ?? 1),
      description: tx.description || '',
      customerId: tx.customerId?._id || tx.customerId || '',
      vendorId: tx.vendorId?._id || tx.vendorId || '',
      inventoryItemId: tx.inventoryItemId?._id || tx.inventoryItemId || '',
      mappingId: tx.mappingId?._id || tx.mappingId || '',
      debitAccountId: tx.debitAccountId?._id || tx.debitAccountId || '',
      creditAccountId: tx.creditAccountId?._id || tx.creditAccountId || '',
    })
  }, [loadTransactionReferenceData, setSelectedTransactionId])

  const getTransactionValidationMessage = useCallback(() => {
    if (!transactionForm.type || !transactionForm.amount) return 'Transaction type and amount are required'
    if (Number(transactionForm.amount) <= 0) return 'Amount must be greater than zero'
    if (['sale', 'receipt'].includes(transactionForm.type) && !transactionForm.customerId) return 'Customer is required for sales and receipts'
    if (['purchase', 'payment'].includes(transactionForm.type) && !transactionForm.vendorId) return 'Vendor is required for purchases and payments'
    return ''
  }, [transactionForm])

  useEffect(() => {
    const normalizedType = String(transactionForm.type || '').toLowerCase()
    if (!['receipt', 'payment'].includes(normalizedType)) return
    let selectedAccountCurrency = ''
    if (normalizedType === 'receipt' && transactionForm.customerId) {
      const customer = customers.find((item) => String(item._id) === String(transactionForm.customerId))
      selectedAccountCurrency = String(customer?.ledgerAccountId?.currency || customer?.currency || '').trim().toUpperCase()
    }
    if (normalizedType === 'payment' && transactionForm.vendorId) {
      const vendor = vendors.find((item) => String(item._id) === String(transactionForm.vendorId))
      selectedAccountCurrency = String(vendor?.ledgerAccountId?.currency || vendor?.currency || '').trim().toUpperCase()
    }
    if (!selectedAccountCurrency) return
    if (String(transactionForm.currency || '').toUpperCase() === selectedAccountCurrency) return
    const matchedCurrency = currencies.find((currency) => String(currency.code || '').toUpperCase() === selectedAccountCurrency)
    const nextRate = Number(matchedCurrency?.exchangeRate || 1)
    setTransactionForm((prev) => ({
      ...prev,
      currency: selectedAccountCurrency,
      exchangeRate: Number.isFinite(nextRate) && nextRate > 0 ? String(nextRate) : prev.exchangeRate,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync party account currency when party changes only
  }, [transactionForm.type, transactionForm.customerId, transactionForm.vendorId, customers, vendors, currencies])

  const handleCreateTransaction = useCallback(async (e) => {
    e.preventDefault()
    const validationMessage = getTransactionValidationMessage()
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...transactionForm,
        currency: baseCurrencyCode,
        exchangeRate: 1,
        amount: Number(transactionForm.amount),
        ...(['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) ? { metalFixStatus: transactionForm.metalFixStatus || 'fixed' } : {}),
      }
      const response = isTransactionEditMode
        ? await erpAccountingAPI.updateTransaction(token, editingTransactionId, payload)
        : await erpAccountingAPI.createTransaction(token, payload)
      resetTransactionComposer()
      setSelectedTransactionId(response.transaction?._id || '')
      await loadTransactions({ cursor: null, cursorHistory: [] })
      showNotification(isTransactionEditMode ? '✅ Transaction updated' : '✅ Transaction created as draft')
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isTransactionEditMode ? 'update' : 'create'} transaction`)
    } finally {
      setSaving(false)
    }
  }, [
    baseCurrencyCode,
    editingTransactionId,
    erpAccountingAPI,
    getTransactionValidationMessage,
    isTransactionEditMode,
    loadTransactions,
    resetTransactionComposer,
    setError,
    setSaving,
    setSelectedTransactionId,
    showNotification,
    token,
    transactionForm,
  ])

  return {
    transactionForm,
    setTransactionForm,
    editingTransactionId,
    setEditingTransactionId,
    isTransactionEditMode,
    resetTransactionComposer,
    populateTransactionForm,
    getTransactionValidationMessage,
    handleCreateTransaction,
  }
}

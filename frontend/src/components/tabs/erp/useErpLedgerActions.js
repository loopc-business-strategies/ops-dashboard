import { useCallback } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { extractLedgerJvDocNoFromDescription } from './journalVoucherHelpers'

export function useErpLedgerActions({
  token,
  editState,
  setEditState,
  setSaving,
  setError,
  loadLedger,
  showNotification,
}) {
  const handleEditLedger = useCallback((entry) => {
    setEditState({
      type: 'ledger',
      record: entry,
      form: {
        date: new Date(entry.date).toISOString().slice(0, 10),
        debitAccountId: entry.debitAccountId?._id || '',
        creditAccountId: entry.creditAccountId?._id || '',
        amount: entry.amount,
        description: entry.description,
        referenceType: entry.referenceType,
        currency: entry.currency,
      },
    })
  }, [setEditState])

  const handleReverseLedger = useCallback(async (entryOrVoucher) => {
    const entry = entryOrVoucher?.representative || entryOrVoucher
    const entryIds = Array.isArray(entryOrVoucher?.entryIds) && entryOrVoucher.entryIds.length
      ? entryOrVoucher.entryIds
      : [entry?._id].filter(Boolean)
    const lineLabel = entryIds.length > 1 ? `${entryIds.length} ledger lines` : 'ledger entry'
    const voucherLabel = extractLedgerJvDocNoFromDescription(entry?.description) || entry?.referenceType || 'entry'
    if (!window.confirm(`Remove ${voucherLabel} (${lineLabel}) from the ledger? This hides the voucher; balances will exclude these lines.`)) return
    try {
      setSaving(true)
      await Promise.all(entryIds.map((id) => erpAccountingAPI.deleteLedgerEntry(token, id)))
      await loadLedger()
      setError('')
      showNotification(`✅ Voucher removed (${entryIds.length} line${entryIds.length === 1 ? '' : 's'})`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to remove voucher')
    } finally {
      setSaving(false)
    }
  }, [token, loadLedger, setSaving, setError, showNotification])

  const handleReconcileLedger = useCallback(async (entry) => {
    try {
      setSaving(true)
      await erpAccountingAPI.reconcileLedgerEntry(token, entry._id)
      await loadLedger()
      showNotification(`✅ Entry marked as ${entry.bankReconciled ? 'Unreconciled' : 'Reconciled'}`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update reconciliation status')
    } finally {
      setSaving(false)
    }
  }, [token, loadLedger, setSaving, setError, showNotification])

  const handleSaveEditLedger = useCallback(async () => {
    if (!editState.form.debitAccountId || !editState.form.creditAccountId || !editState.form.amount) {
      setError('All fields required')
      return
    }
    if (editState.form.debitAccountId === editState.form.creditAccountId) {
      setError('Debit and Credit accounts must be different')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.updateLedgerEntry(token, editState.record._id, editState.form)
      await loadLedger()
      setEditState({ type: '', record: null, form: {} })
      setError('')
      showNotification('✅ Entry updated successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update entry')
    } finally {
      setSaving(false)
    }
  }, [token, editState, loadLedger, setEditState, setSaving, setError, showNotification])

  return {
    handleEditLedger,
    handleReverseLedger,
    handleReconcileLedger,
    handleSaveEditLedger,
  }
}

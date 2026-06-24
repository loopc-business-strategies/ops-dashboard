import { useMemo, useState } from 'react'

export function getTransactionActionSuccessLabel(action) {
  if (action === 'submit') return 'submitted'
  if (action === 'approve') return 'approved'
  if (action === 'return') return 'returned for edit'
  if (action === 'reject') return 'rejected'
  if (action === 'post') return 'posted'
  return action
}

export function getBulkTransactionActionSuccessLabel(action) {
  if (action === 'submit') return 'submitted'
  if (action === 'approve') return 'approved'
  if (action === 'post') return 'posted'
  return action
}

export function useErpTransactionWorkflow({
  token,
  transactions,
  setTransactions,
  selectedTransactionId,
  setSelectedTransactionId,
  editingTransactionId,
  resetTransactionComposer,
  transactionForm,
  loadTransactions,
  loadDashboard,
  setError,
  setSaving,
  showNotification,
  api,
  confirmDelete = (message) => (typeof window === 'undefined' ? true : window.confirm(message)),
}) {
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([])
  const [transactionWorkflowNote, setTransactionWorkflowNote] = useState('')
  const [transactionCommentDraft, setTransactionCommentDraft] = useState('')
  const [transactionAttachmentInputKey, setTransactionAttachmentInputKey] = useState(0)

  const allVisibleTransactionsSelected = useMemo(
    () => Boolean(transactions.length) && transactions.every((tx) => selectedTransactionIds.includes(tx._id)),
    [selectedTransactionIds, transactions],
  )

  const toggleTransactionSelection = (id) => {
    setSelectedTransactionIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  const toggleVisibleTransactionSelection = () => {
    setSelectedTransactionIds((prev) => {
      if (allVisibleTransactionsSelected) {
        return prev.filter((id) => !transactions.some((tx) => tx._id === id))
      }
      return Array.from(new Set([...prev, ...transactions.map((tx) => tx._id)]))
    })
  }

  const handleDeleteTransaction = async (id) => {
    if (!confirmDelete('Delete this transaction?')) return
    try {
      setSaving(true)
      await api.deleteTransaction(token, id)
      if (selectedTransactionId === id) setSelectedTransactionId('')
      if (editingTransactionId === id) resetTransactionComposer()
      setSelectedTransactionIds((prev) => prev.filter((item) => item !== id))
      await loadTransactions()
      showNotification('✅ Transaction deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleTransactionAction = async (action, id) => {
    try {
      setSaving(true)
      if ((action === 'return' || action === 'reject') && !transactionWorkflowNote.trim()) {
        setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
        setSaving(false)
        return
      }
      const payload = {
        comment: transactionWorkflowNote,
        ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
        ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
      }
      if (action === 'submit') await api.submitTransaction(token, id, payload)
      if (action === 'approve') await api.approveTransaction(token, id, payload)
      if (action === 'return') await api.returnTransaction(token, id, payload)
      if (action === 'reject') await api.rejectTransaction(token, id, payload)
      if (action === 'post') await api.postTransaction(token, id, payload)
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      showNotification(`✅ Transaction ${getTransactionActionSuccessLabel(action)}`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} transaction`)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransactionComment = async () => {
    if (!selectedTransactionId) {
      setError('Select a transaction first')
      return
    }
    if (!transactionCommentDraft.trim()) {
      setError('Enter a comment first')
      return
    }
    try {
      setSaving(true)
      await api.addTransactionComment(token, selectedTransactionId, { message: transactionCommentDraft })
      await loadTransactions()
      setTransactionCommentDraft('')
      showNotification('✅ Transaction comment added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add transaction comment')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTransactionChat = async (transactionId, message, mentionedNames = []) => {
    if (!transactionId) {
      setError('Select a transaction first')
      return false
    }
    if (!String(message || '').trim()) {
      setError('Enter a message first')
      return false
    }
    try {
      setSaving(true)
      const data = await api.addTransactionComment(token, transactionId, {
        message,
        mentionedNames,
      })
      if (data.transaction) {
        setTransactions((prev) => prev.map((tx) => (tx._id === transactionId ? data.transaction : tx)))
      }
      const deliveredCount = Array.isArray(data.deliveredTo) ? data.deliveredTo.length : 0
      showNotification(deliveredCount ? `Transaction chat sent to ${deliveredCount} user${deliveredCount === 1 ? '' : 's'}` : 'Transaction note saved; no mentioned user matched')
      return true
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to send transaction chat')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleUploadTransactionAttachment = async (file, transactionId = selectedTransactionId) => {
    if (!transactionId) {
      setError('Select a transaction first')
      return
    }
    if (!file) return
    try {
      setSaving(true)
      setSelectedTransactionId(transactionId)
      await api.uploadTransactionAttachment(token, transactionId, file)
      await loadTransactions()
      setTransactionAttachmentInputKey((prev) => prev + 1)
      showNotification('✅ Attachment uploaded')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload attachment')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransactionAttachment = async (attachmentId) => {
    if (!selectedTransactionId || !attachmentId) return
    try {
      setSaving(true)
      await api.deleteTransactionAttachment(token, selectedTransactionId, attachmentId)
      await loadTransactions()
      showNotification('✅ Attachment deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete attachment')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkTransactionAction = async (action) => {
    if (!selectedTransactionIds.length) {
      setError('Select at least one transaction')
      return
    }
    try {
      setSaving(true)
      const response = await api.bulkTransactionAction(token, {
        ids: selectedTransactionIds,
        action,
        comment: transactionWorkflowNote,
        mappingOverride: {
          ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
          ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
        },
      })
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      setSelectedTransactionIds([])
      if (!response.failureCount) {
        showNotification(`✅ ${response.successCount} transactions ${getBulkTransactionActionSuccessLabel(action)}`)
      } else {
        setError(`${response.successCount} succeeded, ${response.failureCount} failed`)
      }
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} selected transactions`)
    } finally {
      setSaving(false)
    }
  }

  return {
    selectedTransactionIds,
    setSelectedTransactionIds,
    transactionWorkflowNote,
    setTransactionWorkflowNote,
    transactionCommentDraft,
    setTransactionCommentDraft,
    transactionAttachmentInputKey,
    allVisibleTransactionsSelected,
    toggleTransactionSelection,
    toggleVisibleTransactionSelection,
    handleDeleteTransaction,
    handleTransactionAction,
    handleAddTransactionComment,
    handleSendTransactionChat,
    handleUploadTransactionAttachment,
    handleDeleteTransactionAttachment,
    handleBulkTransactionAction,
  }
}

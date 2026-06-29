import { useCallback } from 'react'

export function useErpTransactionNavigation({
  setSelectedTransactionId,
  setVoucherSource,
  setActiveTabGuarded,
  loadTransactions,
  showNotification,
}) {
  const handleJumpToTransaction = useCallback(async (transactionId) => {
    if (!transactionId) return
    setSelectedTransactionId(transactionId)
    setVoucherSource(null)
    setActiveTabGuarded('transactions')
    try {
      await loadTransactions()
    } catch {
      // Errors are handled by loadTransactions state updates.
    }
    showNotification('✅ Jumped to linked transaction')
  }, [
    setSelectedTransactionId,
    setVoucherSource,
    setActiveTabGuarded,
    loadTransactions,
    showNotification,
  ])

  return { handleJumpToTransaction }
}

import { emptyHeader } from './voucherTabShared'

/**
 * ERP toolbar navigation, search, unlock, cancel, barcode, exit, delete.
 */
export function useVoucherToolbarNav({
  vouchers,
  editingId,
  mode,
  header,
  lineItems,
  voucherType,
  isReadOnly,
  currentVoucherStatus,
  lastViewedIdRef,
  openVoucher,
  openCreate,
  fetchServerNextVocNo,
  resolveNextVocNo,
  sortVouchers,
  voucherErpApi,
  token,
  loadVouchers,
  setError,
  clearError,
  showMsg,
  setMode,
  setHeader,
  setSelectedPartyId,
  setRecentPartyVouchers,
  setLineItems,
  setShowLineForm,
  setEditingLineIdx,
  setWorkflowNote,
  setVouchers,
}) {
  const navFirst = () => {
  if (!vouchers.length) {
    setError('No vouchers available for this voucher type')
    return
  }
  openVoucher(vouchers[0])
}
const navPrev = () => {
  if (!vouchers.length) {
    setError('No vouchers available for this voucher type')
    return
  }
  const idx = vouchers.findIndex(v => v._id === editingId)
  if (idx === -1) {
    openVoucher(vouchers[vouchers.length - 1])
    return
  }
  if (idx > 0) {
    openVoucher(vouchers[idx - 1])
    return
  }
  showMsg('Already at first voucher')
}
const navNext = () => {
  if (!vouchers.length) {
    setError('No vouchers available for this voucher type')
    return
  }
  const idx = vouchers.findIndex(v => v._id === editingId)
  if (idx === -1) {
    openVoucher(vouchers[0])
    return
  }
  if (idx >= 0 && idx < vouchers.length - 1) {
    openVoucher(vouchers[idx + 1])
    return
  }
  showMsg('Already at last voucher')
}
const navLast = () => {
  if (!vouchers.length) {
    setError('No vouchers available for this voucher type')
    return
  }
  openVoucher(vouchers[vouchers.length - 1])
}

const handleEditUnlock = () => {
  if (isReadOnly) {
    setError('You have read-only access')
    return
  }
  if (!editingId) {
    if (mode !== 'create') {
      setError('Open a voucher first, then click Edit')
    } else {
      showMsg('Already in EDIT mode')
    }
    return
  }
  if (currentVoucherStatus === 'posted') {
    if (!window.confirm('Editing a posted voucher will reverse its ledger entries and reset it to Draft status. Proceed?')) return
  }
  setMode('create')
  clearError()
  showMsg('Mode: EDIT')
}

const handleCancelChanges = () => {
  if (mode === 'create') {
    if (window.confirm('Discard unsaved changes?')) {
      // If editing an existing voucher, revert to it
      if (editingId) {
        const existing = vouchers.find((v) => v._id === editingId)
        if (existing) {
          openVoucher(existing)
          showMsg('Changes discarded')
          return
        }
      }
      // New blank form — go back to last viewed voucher if available
      const prev = lastViewedIdRef.current
        ? vouchers.find(v => v._id === lastViewedIdRef.current)
        : null
      if (prev) {
        openVoucher(prev)
        showMsg('Cancelled — returned to last entry')
      } else if (vouchers.length > 0) {
        openVoucher(vouchers[vouchers.length - 1])
        showMsg('Cancelled — returned to last entry')
      } else {
        setMode('list')
      }
    }
    return
  }
  setMode('list')
}

const handleSearchFind = () => {
  const term = window.prompt('Search vouchers by voucher number, party code/name, or date (YYYY-MM-DD):', '')
  if (term === null) return
  const q = String(term || '').trim().toLowerCase()
  if (!q) {
    showMsg('Search cleared')
    return
  }

  const match = vouchers.find((v) => {
    const m = v.voucherMeta || {}
    const vocNo = String(m.vocNo || '').toLowerCase()
    const partyCode = String(m.partyCode || '').toLowerCase()
    const partyName = String(m.partyName || '').toLowerCase()
    const dt = String(v.date || '').slice(0, 10).toLowerCase()
    return vocNo.includes(q) || partyCode.includes(q) || partyName.includes(q) || dt.includes(q)
  })

  if (match) {
    openVoucher(match)
    showMsg(`Found voucher #${match.voucherMeta?.vocNo || '-'}`)
    return
  }

  setError('No voucher matched your search')
}

const handleBarcodeAction = () => {
  const activeLine = lineItems.find((line) => String(line.stockCode || '').trim())
  const stockCode = activeLine?.stockCode || 'N/A'
  const voucherNo = header.vocNo || 'NEW'
  alert(`Voucher: ${voucherNo}\nStock Barcode Ref: ${stockCode}`)
}

const handleExitVoucherForm = () => {
  setMode('list')
  showMsg('Closed voucher form')
}

const handleDeleteVoucher = async () => {
  if (isReadOnly) {
    setError('You have read-only access')
    return
  }

  if (!editingId && mode === 'create') {
    const hasData = String(header.partyCode || '').trim() || lineItems.length > 0 || String(header.narration || '').trim()
    if (!hasData) {
      showMsg('Nothing to delete')
      return
    }
    if (!window.confirm('Clear this unsaved voucher entry?')) return
    const cleared = emptyHeader()
    const serverVocNo = await fetchServerNextVocNo(voucherType, cleared.docDate)
    setHeader({ ...cleared, vocNo: serverVocNo || resolveNextVocNo(undefined, voucherType, cleared.docDate) })
    setSelectedPartyId('')
    setRecentPartyVouchers([])
    setLineItems([])
    setShowLineForm(false)
    setEditingLineIdx(null)
    setWorkflowNote('')
    clearError()
    showMsg('Unsaved voucher cleared')
    return
  }

  if (!editingId) {
    setError('No saved voucher selected to delete')
    return
  }

  if (currentVoucherStatus === 'posted') {
    setError('Posted vouchers cannot be deleted because they already affect ledger and stock')
    return
  }

  if (!window.confirm(`Delete voucher #${header.vocNo}? This cannot be undone.`)) return
  try {
    const deletedId = editingId
    const deletedIdx = vouchers.findIndex(v => v._id === deletedId)
    await voucherErpApi.deleteTransaction(token, deletedId)
    showMsg('Voucher deleted')
    await loadVouchers()
    const res = await voucherErpApi.getTransactions(token, { type: voucherType, limit: 200 })
    const remaining = sortVouchers(
      (res.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
      voucherType
    )
    setVouchers(remaining)
    if (remaining.length === 0) {
      // No vouchers left — open a blank new form
      openCreate()
    } else {
      // Try to open the next record (same index), else the one before it
      const nextIdx = Math.min(deletedIdx, remaining.length - 1)
      openVoucher(remaining[Math.max(nextIdx, 0)])
    }
  } catch (e) {
    setError(e.response?.data?.message || 'Failed to delete voucher')
  }
}

  return {
    navFirst,
    navPrev,
    navNext,
    navLast,
    handleEditUnlock,
    handleCancelChanges,
    handleSearchFind,
    handleBarcodeAction,
    handleExitVoucherForm,
    handleDeleteVoucher,
  }
}

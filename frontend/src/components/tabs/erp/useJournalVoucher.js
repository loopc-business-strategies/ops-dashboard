import { useCallback, useRef, useState } from 'react'
import {
  allocateJvLedgerEntries,
  applyBankJvExchangeBalancing,
  buildJvPostingPayloads,
  buildJvPrintHtml,
  emptyJvLine,
  filterJvEditableEntries,
  inferLegacyJvBatchDisplayFc,
  makeJvGroupObjectId,
  normalizeJvCurrencyCode,
  reconstructJvEditLines,
  resolveJvModeMeta,
  validateJvLines,
} from './journalVoucherHelpers'
import { accountLookupText, resolveAccountIdFromInput } from './erpTabUtils'

/**
 * Journal / Bank JV line editing, validation, edit-load, and multi-line save.
 * Uses a ref so callbacks stay stable while always reading the latest props from ERPTab.
 */
export function useJournalVoucher(props) {
  const propsRef = useRef(props)
  propsRef.current = props
  const [jvError, setJvError] = useState('')
  const saveInFlightRef = useRef(false)

  const extractJvSaveError = (e) =>
    e?.response?.data?.message || e?.message || 'Failed to save Journal Voucher'

  const refreshJvDocNo = async (mode) => {
    const p = propsRef.current
    const refType = resolveJvModeMeta(mode ?? p.jvMode).referenceType
    try {
      if (p.token) {
        const data = await p.erpAccountingAPI.getNextJvDocNo(p.token, refType)
        if (data?.success && data.docNo) return data.docNo
      }
    } catch (_) { /* keep current */ }
    return p.jvHeader.docNo
  }

  const toBatchPostings = (payloads) => payloads.map((payload) => ({
    date: payload.date,
    description: payload.description,
    notes: payload.notes,
    currency: payload.currency,
    exchangeRate: payload.exchangeRate,
    debitAccountId: payload.debitAccountId,
    creditAccountId: payload.creditAccountId,
    amount: payload.amount,
  }))

  const postJournalVoucherBatch = async (postings, replaceEntryIds) => {
    const p = propsRef.current
    return p.erpAccountingAPI.createJournalVoucherBatch(p.token, {
      mode: p.jvMode,
      postings,
      ...(replaceEntryIds?.length ? { replaceEntryIds } : {}),
    })
  }

  const bankBalanceCtx = () => {
    const p = propsRef.current
    return {
      jvMode: p.jvMode,
      entryAccountOptions: p.entryAccountOptions,
      baseCurrencyCode: p.baseCurrencyCode,
      convertJvAmount: p.convertJvAmount,
      inferJvAccountCurrency: p.inferJvAccountCurrency,
      accountLookupText,
    }
  }

  const getJvAccountById = (accountId) => {
    const { entryAccountOptions } = propsRef.current
    return entryAccountOptions.find((item) => String(item?._id) === String(accountId || '')) || null
  }

  /** Stable ref; reads latest `entryAccountOptions` via `propsRef` (avoids stale hook deps in callers). */
  const isExchangeLine = useCallback((line) => {
    const { entryAccountOptions } = propsRef.current
    const acc = entryAccountOptions.find((item) => String(item?._id) === String(line?.accountId || '')) || null
    const code = String(acc?.accountCode || '').trim().toUpperCase()
    return ['4190', '5190'].includes(code)
  }, [])

  const updateJvLine = useCallback((id, field, value) => {
    const p = propsRef.current
    const applyFx = (lines) => applyBankJvExchangeBalancing(lines, bankBalanceCtx())
    p.setJvLines((prev) => {
      const withEdited = prev.map((line) => {
        if (line.id !== id) return line
        if (field === 'debit') return { ...line, debit: value, credit: '', autoFx: false, autoSync: false }
        if (field === 'credit') return { ...line, credit: value, debit: '', autoFx: false, autoSync: false }
        return { ...line, [field]: value, autoFx: false, autoSync: false }
      })
      if (p.jvMode !== 'bank_jv' || !['debit', 'credit'].includes(field)) return withEdited
      const enteredAmount = Number(value || 0)
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) return applyFx(withEdited)
      const sourceLine = withEdited.find((line) => line.id === id)
      if (!sourceLine?.accountId) return applyFx(withEdited)
      if (isExchangeLine(sourceLine) && enteredAmount > 0) return withEdited
      const targetField = field === 'debit' ? 'credit' : 'debit'
      const targetLine = withEdited.find((line) => {
        if (line.id === id) return false
        if (!String(line.accountId || '').trim()) return false
        if (isExchangeLine(line)) return false
        return true
      })
      if (!targetLine) return applyFx(withEdited)
      const existingTargetValue = Number(targetLine[targetField] || 0)
      const preserveManualTarget = Number.isFinite(existingTargetValue)
        && existingTargetValue > 0
        && !targetLine.autoSync
      if (preserveManualTarget) {
        return applyFx(withEdited)
      }
      const sourceCurrency = p.inferJvAccountCurrency(sourceLine.accountId)
      const targetCurrency = p.inferJvAccountCurrency(targetLine.accountId)
      const convertedAmount = p.convertJvAmount(enteredAmount, sourceCurrency, targetCurrency)
      if (!Number.isFinite(convertedAmount) || convertedAmount <= 0) return applyFx(withEdited)
      const withSyncedPair = withEdited.map((line) => {
        if (line.id !== targetLine.id) return line
        return targetField === 'debit'
          ? { ...line, debit: String(convertedAmount), credit: '', autoFx: false, autoSync: true }
          : { ...line, credit: String(convertedAmount), debit: '', autoFx: false, autoSync: true }
      })
      return applyFx(withSyncedPair)
    })
  }, [isExchangeLine])

  const resolveJvLineAccount = useCallback((lineId, value, label = '') => {
    const p = propsRef.current
    const resolvedId = resolveAccountIdFromInput(value, p.entryAccountOptions)
    const account = resolvedId ? p.entryAccountOptions.find((a) => String(a._id) === String(resolvedId)) : null
    const resolvedLabel = account ? accountLookupText(account) : label
    p.setJvLines((prev) => {
      const withResolved = prev.map((line) => (
        line.id !== lineId
          ? line
          : { ...line, accountId: resolvedId || '', accountInput: resolvedLabel || '', autoFx: false, autoSync: false }
      ))
      return applyBankJvExchangeBalancing(withResolved, bankBalanceCtx())
    })
  }, [])

  const getJvValidation = useCallback((lines) => {
    const p = propsRef.current
    return validateJvLines({
      lines,
      jvMode: p.jvMode,
      jvHeader: p.jvHeader,
      baseCurrencyCode: p.baseCurrencyCode,
      inventoryTenantKey: p.inventoryTenantKey,
      inferJvAccountCurrency: p.inferJvAccountCurrency,
      convertJvAmount: p.convertJvAmount,
      isExchangeLine,
    })
  }, [isExchangeLine])

  const addJvLine = useCallback(() => {
    const p = propsRef.current
    p.setJvLines((prev) => [...prev, emptyJvLine(p.nextJvLineId)])
    p.setNextJvLineId((n) => n + 1)
  }, [])

  const removeJvLine = useCallback((id) => {
    propsRef.current.setJvLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const handleJvLineKeyDown = useCallback((e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const p = propsRef.current
      if (idx === p.jvLines.length - 1) {
        p.setJvLines((prev) => [...prev, emptyJvLine(p.nextJvLineId)])
        p.setNextJvLineId((n) => n + 1)
      }
    }
  }, [])

  const handleJvAccountKeyDown = useCallback((e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const p = propsRef.current
      if (idx === p.jvLines.length - 1) {
        p.setJvLines((prev) => [...prev, emptyJvLine(p.nextJvLineId)])
        p.setNextJvLineId((n) => n + 1)
      }
    }
  }, [])

  const resetJvModalChrome = useCallback(() => {
    const p = propsRef.current
    p.setJvModalOffset({ x: 0, y: 0 })
    p.setJvModalDrag({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
    p.setJvModalResize({
      active: false,
      pointerX: 0,
      pointerY: 0,
      startW: p.JV_MODAL_DEFAULT_SIZE.width,
      startH: p.JV_MODAL_DEFAULT_SIZE.height,
    })
    p.setJvModalSize(p.JV_MODAL_DEFAULT_SIZE)
  }, [])

  const resetJvForm = useCallback(async (mode = 'journal') => {
    const p = propsRef.current
    p.setJvMode(mode)
    p.setJvLines([emptyJvLine(1), emptyJvLine(2)])
    p.setNextJvLineId(3)
    p.setJvEditEntryIds([])
    p.setJvReadOnly(false)
    let docNo = p.buildJvDocNo(mode)
    const refType = resolveJvModeMeta(mode).referenceType
    try {
      if (p.token) {
        const data = await p.erpAccountingAPI.getNextJvDocNo(p.token, refType)
        if (data?.success && data.docNo) docNo = data.docNo
      }
    } catch (_) { /* keep client-side sequence */ }
    p.setJvHeader({
      docNo,
      date: new Date().toISOString().slice(0, 10),
      narration: '',
      currency: p.baseCurrencyCode,
    })
  }, [])

  const loadJvFromEntry = useCallback(async (entry, { readOnly = false } = {}) => {
    const p = propsRef.current
    const rawDesc = String(entry.description || '')
    const docNoHead = (rawDesc.includes(' — ') ? rawDesc.split(' — ') : rawDesc.split(' - '))[0]?.trim() || ''
    const docNo = docNoHead
    const hasDocPrefix = /^(jv|bnkjv)[/-]/i.test(String(docNo || ''))
    const entryMode = String(entry?.referenceType || '').toLowerCase() === 'bank_jv' ? 'bank_jv' : 'journal'
    const refTypeFilter = entryMode
    let docMatchedEntries = [entry]
    try {
      const batchId = entry.referenceId ? String(entry.referenceId).trim() : ''
      if (batchId && /^[a-fA-F0-9]{24}$/.test(batchId)) {
        const data = await p.erpAccountingAPI.getLedger(p.token, {
          referenceType: refTypeFilter,
          referenceId: batchId,
          limit: 300,
          page: 1,
        })
        if (Array.isArray(data?.entries) && data.entries.length) {
          docMatchedEntries = data.entries
        }
      } else if (docNo && hasDocPrefix) {
        const data = await p.erpAccountingAPI.getLedger(p.token, {
          referenceType: refTypeFilter,
          docNoPrefix: docNo,
          limit: 300,
          page: 1,
        })
        if (Array.isArray(data?.entries) && data.entries.length) {
          docMatchedEntries = data.entries
        }
      }
    } catch (e) {
      p.setError(e.response?.data?.message || (readOnly ? 'Failed to load JV lines' : 'Failed to load JV lines for editing'))
      setJvError(e.response?.data?.message || (readOnly ? 'Failed to load JV lines' : 'Failed to load JV lines for editing'))
      return false
    }
    const editableEntries = filterJvEditableEntries(docMatchedEntries, entry, entryMode)
    const reconstructed = reconstructJvEditLines(editableEntries, entry, {
      baseCurrencyCode: p.baseCurrencyCode,
      normalizeJvCurrencyCode,
      convertJvAmount: p.convertJvAmount,
      inferJvAccountCurrency: p.inferJvAccountCurrency,
      inferLegacyJvBatchDisplayFc,
    })
    p.setJvMode(reconstructed.entryMode)
    p.setJvEditEntryIds(reconstructed.jvEditEntryIds)
    p.setJvLines(reconstructed.lines)
    p.setNextJvLineId(reconstructed.nextJvLineId)
    p.setJvHeader({
      docNo: reconstructed.headerDocNo,
      date: reconstructed.entryDate,
      narration: reconstructed.narration,
      currency: reconstructed.headerCurrency,
    })
    p.setJvReadOnly(readOnly)
    resetJvModalChrome()
    p.setShowLedgerForm(true)
    return true
  }, [resetJvModalChrome])

  const handleOpenJv = useCallback(async (entry) => {
    await loadJvFromEntry(entry, { readOnly: true })
  }, [loadJvFromEntry])

  const handleEditJv = useCallback(async (entry) => {
    await loadJvFromEntry(entry, { readOnly: false })
  }, [loadJvFromEntry])

  const closeJvModal = useCallback(() => {
    const p = propsRef.current
    p.setShowLedgerForm(false)
    setJvError('')
    void resetJvForm(p.ledgerVoucherTab)
    resetJvModalChrome()
  }, [resetJvForm, resetJvModalChrome])

  const openJvModal = useCallback(async (mode) => {
    const p = propsRef.current
    setJvError('')
    await resetJvForm(mode ?? p.ledgerVoucherTab)
    resetJvModalChrome()
    p.setShowLedgerForm(true)
  }, [resetJvForm, resetJvModalChrome])

  const switchJvMode = useCallback(async (mode) => {
    const p = propsRef.current
    if (p.jvEditEntryIds.length > 0 || p.jvReadOnly) return
    p.setJvMode(mode)
    let docNo = p.buildJvDocNo(mode)
    try {
      if (p.token) {
        const data = await p.erpAccountingAPI.getNextJvDocNo(p.token, resolveJvModeMeta(mode).referenceType)
        if (data?.success && data.docNo) docNo = data.docNo
      }
    } catch (_) { /* keep client fallback */ }
    p.setJvHeader((prev) => ({ ...prev, docNo }))
  }, [])

  const handleRepairJvFxPreview = useCallback(async () => {
    const p = propsRef.current
    if (!p.canCloseLedgerPeriod || !p.token) return
    p.setSaving(true)
    try {
      const data = await p.erpAccountingAPI.repairJvFxPreview(p.token, { mode: 'coa' })
      const msg = `Preview: ${data.updated} postings would update (${data.candidateRows} base+1 candidates). Skipped line-events: ${data.skipped}.`
      p.showNotification(msg)
      if (Array.isArray(data.skipSamples) && data.skipSamples.length) {
        console.info('[repairJvFx preview skip samples]', data.skipSamples)
      }
      p.setError('')
    } catch (e) {
      p.setError(e.response?.data?.message || 'JV FX repair preview failed')
    } finally {
      p.setSaving(false)
    }
  }, [])

  const handleRepairJvFxApply = useCallback(async () => {
    const p = propsRef.current
    if (!p.canCloseLedgerPeriod || !p.token) return
    const reason = window.prompt('Maintenance reason (min 8 characters)', 'JV ledger backfill store UZS and FX rate')
    if (!reason || String(reason).trim().length < 8) {
      p.showNotification('Apply cancelled: reason must be at least 8 characters.')
      return
    }
    const confirmToken = window.prompt('Enter server DESTRUCTIVE_ADMIN_CONFIRM_TOKEN (production also needs ENABLE_DESTRUCTIVE_ADMIN_API=true)')
    if (!confirmToken?.trim()) {
      p.showNotification('Apply cancelled.')
      return
    }
    p.setSaving(true)
    try {
      const data = await p.erpAccountingAPI.repairJvFxApply(p.token, {
        mode: 'coa',
        confirmToken: String(confirmToken).trim(),
        reason: String(reason).trim(),
      })
      p.showNotification(data.message || `Updated ${data.updated} ledger postings`)
      p.setError('')
      await p.loadLedger()
    } catch (e) {
      p.setError(e.response?.data?.message || 'JV FX repair apply failed')
    } finally {
      p.setSaving(false)
    }
  }, [])

  const handleSaveMultiLineJV = useCallback(async () => {
    const p = propsRef.current
    if (saveInFlightRef.current) return

    const validation = getJvValidation(p.jvLines)
    if (validation.hasLineIssues) {
      const firstLineIssue = Object.values(validation.lineIssuesById)[0]
      const msg = firstLineIssue || 'Please fix JV row errors before saving'
      setJvError(msg)
      p.setError(msg)
      return
    }
    if (!validation.activeLines.length) {
      const msg = 'Add at least one debit row and one credit row'
      setJvError(msg)
      p.setError(msg)
      return
    }
    if (!validation.isBalanced) {
      const msg = 'Debit and Credit totals are not balanced'
      setJvError(msg)
      p.setError(msg)
      return
    }
    const allocation = allocateJvLedgerEntries(validation.activeLines, {
      jvLines: p.jvLines,
      useRawJvLineAmountsForSave: validation.useRawJvLineAmountsForSave,
    })
    if (allocation.error) {
      setJvError(allocation.error)
      p.setError(allocation.error)
      return
    }
    const entries = allocation.entries
    const isEdit = p.jvEditEntryIds.length > 0

    let headerForSave = { ...p.jvHeader }
    if (!isEdit) {
      const freshDocNo = await refreshJvDocNo()
      if (freshDocNo) {
        headerForSave = { ...headerForSave, docNo: freshDocNo }
        p.setJvHeader((prev) => ({ ...prev, docNo: freshDocNo }))
      }
    }

    const jvGroupId = makeJvGroupObjectId()
    const built = buildJvPostingPayloads({
      entries,
      jvHeader: headerForSave,
      baseCurrencyCode: p.baseCurrencyCode,
      currencies: p.currencies,
      jvMode: p.jvMode,
      jvGroupId,
      normalizeJvCurrencyCode,
      strictUseDocCurrency: Boolean(validation.useDocCurrency),
    })
    if (built.error) {
      setJvError(built.error)
      p.setError(built.error)
      return
    }

    saveInFlightRef.current = true
    p.setSaving(true)
    setJvError('')
    p.setError('')

    const replaceEntryIds = isEdit ? [...p.jvEditEntryIds] : []
    const runSave = async (postings) => postJournalVoucherBatch(postings, replaceEntryIds)

    try {
      let batchResult
      try {
        batchResult = await runSave(toBatchPostings(built.payloads))
      } catch (e) {
        if (e?.response?.status === 409 && !isEdit) {
          const bumpedDocNo = await refreshJvDocNo()
          const retryHeader = { ...headerForSave, docNo: bumpedDocNo || headerForSave.docNo }
          p.setJvHeader((prev) => ({ ...prev, docNo: retryHeader.docNo }))
          const rebuilt = buildJvPostingPayloads({
            entries,
            jvHeader: retryHeader,
            baseCurrencyCode: p.baseCurrencyCode,
            currencies: p.currencies,
            jvMode: p.jvMode,
            jvGroupId: makeJvGroupObjectId(),
            normalizeJvCurrencyCode,
            strictUseDocCurrency: Boolean(validation.useDocCurrency),
          })
          if (rebuilt.error) throw e
          batchResult = await runSave(toBatchPostings(rebuilt.payloads))
        } else {
          throw e
        }
      }

      const isBankJV = p.jvMode === 'bank_jv'
      const voucherLabel = isBankJV ? 'Bank JV' : 'Journal Voucher'
      const n = Number(batchResult?.count || built.payloads.length)
      closeJvModal()
      await Promise.all([p.loadLedger(), p.loadDashboard()])
      p.showNotification(isEdit
        ? `✅ ${voucherLabel} updated — ${n} entr${n === 1 ? 'y' : 'ies'} reposted`
        : `✅ ${voucherLabel} saved — ${n} entr${n === 1 ? 'y' : 'ies'} posted`)
    } catch (e) {
      const msg = extractJvSaveError(e)
      setJvError(msg)
      p.setError(msg)
    } finally {
      saveInFlightRef.current = false
      p.setSaving(false)
    }
  }, [getJvValidation, closeJvModal])

  const handlePrintJvVoucher = useCallback(async () => {
    const p = propsRef.current
    const validation = getJvValidation(p.jvLines)
    const modeMeta = resolveJvModeMeta(p.jvMode)
    const logoMarkup = await p.buildBrandingLogoTag(p.branding, 'margin-left:auto;')
    const body = buildJvPrintHtml({
      validation,
      jvLines: p.jvLines,
      jvHeader: p.jvHeader,
      modeMeta,
      branding: p.branding,
      defaultCompanyName: p.defaultCompanyName,
      baseCurrencyCode: p.baseCurrencyCode,
      preparedBy: p.user?.name || '',
      logoMarkup,
      getJvAccountById,
    })
    p.openPrintWindow(modeMeta.badge, body)
    p.showNotification('JV print layout opened')
  }, [getJvValidation])

  return {
    jvError,
    setJvError,
    updateJvLine,
    resolveJvLineAccount,
    getJvValidation,
    addJvLine,
    removeJvLine,
    handleJvLineKeyDown,
    handleJvAccountKeyDown,
    resetJvForm,
    loadJvFromEntry,
    handleOpenJv,
    handleEditJv,
    closeJvModal,
    openJvModal,
    switchJvMode,
    handleRepairJvFxPreview,
    handleRepairJvFxApply,
    handleSaveMultiLineJV,
    handlePrintJvVoucher,
    getJvAccountById,
    isExchangeLine,
  }
}

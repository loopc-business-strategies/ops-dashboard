import { useCallback } from 'react'
import { parseAmount, toMoney } from '../../../utils/money'
import {
  emptyLine,
  getAccountCodeValue,
  hasMetalTransferLineQuantity,
  normalizeLineType,
  normalizeRateType,
  pickDefaultAccountCodeByType,
} from './voucherTabShared'

/**
 * Line-item form open/edit/save and payment/receipt amount helpers for VoucherTab.
 */
export function useVoucherLineForm({
  header,
  setHeader,
  lineForm,
  setLineForm,
  setLF,
  lineItems,
  setLineItems,
  showLineForm,
  setShowLineForm,
  editingLineIdx,
  setEditingLineIdx,
  activeAccounts,
  currencyOptions,
  voucherType,
  isMetalVoucher,
  isSimpleMetalVoucher,
  isReadOnly,
  mode,
  setMode,
  setError,
  clearError,
  showMsg,
  applyLineAutoCalc,
  resolvePaymentRate,
}) {
  const buildReceiptPaymentDefaultLine = (baseLine) => {
    const rate = parseFloat(header.currRate) || 1
    return {
      ...baseLine,
      currCode: header.currCode || 'USD',
      currRate: String(rate.toFixed(6)),
      currRateSource: header.currRateSource || 'currency_table',
      vatType: baseLine.vatType || 'VAT',
      narration: header.narration || '',
      amountFC: '',
      amountLC: '',
      amountWithVAT: '',
    }
  }

  const openAddLine = () => {
    setEditingLineIdx(null)
    const defaultType = 'Cash'
    const defaultAccountCode = pickDefaultAccountCodeByType(activeAccounts, defaultType)
    const baseLine = {
      ...emptyLine(),
      currCode: header.currCode || 'USD',
      currRate: header.currRate || '1.000000',
      currRateSource: header.currRateSource || 'currency_table',
      type: defaultType,
      typeCode: defaultType.toUpperCase(),
      acCode: defaultAccountCode || '',
    }

    setLineForm(isMetalVoucher ? baseLine : buildReceiptPaymentDefaultLine(baseLine))
    setShowLineForm(true)
  }

  const openEditLine = (idx) => {
    setEditingLineIdx(idx)
    const row = lineItems[idx] || {}
    const normalizedType = normalizeLineType(row?.type)
    setLineForm({
      ...row,
      inventoryItemId: String(row?.inventoryItemId?._id || row?.inventoryItemId || ''),
      type: normalizedType,
      typeCode: normalizedType.toUpperCase(),
      rateType: normalizeRateType(row?.rateType),
      currRateSource: row?.currRateSource || 'manual',
      vatType: row?.vatType || 'VAT',
    })
    setShowLineForm(true)
  }

  const deleteLine = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx))

  const ensureEditableForLineActions = () => {
    if (isReadOnly) {
      setError('You have read-only access')
      return false
    }
    if (mode === 'view') {
      setMode('create')
      clearError()
      showMsg('Mode: EDIT')
    }
    return true
  }

  const handleAddLineClick = () => {
    if (!ensureEditableForLineActions()) return
    openAddLine()
  }

  const handleEditLineClick = (idx) => {
    if (!ensureEditableForLineActions()) return
    openEditLine(idx)
  }

  const handleDeleteLineClick = (idx) => {
    if (!ensureEditableForLineActions()) return
    deleteLine(idx)
  }

  const cancelLine = () => {
    setShowLineForm(false)
    setEditingLineIdx(null)
    clearError()
  }

  const saveLine = () => {
    if (!isMetalVoucher && !lineForm.acCode.trim()) { setError('A/C Code is required'); return }
    if (isMetalVoucher && !lineForm.stockCode.trim()) { setError('Stock Code is required for metal vouchers'); return }
    if (isSimpleMetalVoucher) {
      if (!hasMetalTransferLineQuantity(lineForm)) {
        setError('Gross weight, pure weight, or PCS is required')
        return
      }
    } else if (!lineForm.amountLC && !lineForm.amountFC && !lineForm.totalAmount && !lineForm.metalAmount) {
      setError('Amount is required')
      return
    }
    const computedLineForm = isMetalVoucher && !isSimpleMetalVoucher ? applyLineAutoCalc(lineForm) : lineForm
    const line = {
      ...computedLineForm,
      type: normalizeLineType(computedLineForm.type),
      amountLC: isSimpleMetalVoucher ? '' : (computedLineForm.amountLC || computedLineForm.totalAmount || computedLineForm.metalAmount || ''),
      amountWithVAT: isSimpleMetalVoucher ? '' : (computedLineForm.amountWithVAT || computedLineForm.amountLC || computedLineForm.amountFC),
    }
    if (editingLineIdx !== null) {
      setLineItems((prev) => prev.map((l, i) => (i === editingLineIdx ? line : l)))
    } else {
      setLineItems((prev) => [...prev, line])
    }
    setShowLineForm(false)
    setEditingLineIdx(null)
    clearError()
  }

  const recalcReceiptPaymentLine = (baseLine, source) => {
    const next = { ...baseLine }
    const parseEditableNumber = (value) => {
      const raw = String(value ?? '').trim()
      if (!raw || raw === '.' || raw === '-' || raw === '-.') return null
      return parseAmount(raw)
    }

    const rawRate = String(next.currRate ?? '')
    const rawAmountFC = String(next.amountFC ?? '')
    const rawAmountLC = String(next.amountLC ?? '')

    const parsedRate = parseEditableNumber(rawRate)
    const headerRate = parseEditableNumber(header.currRate)
    const rate = parsedRate ?? headerRate ?? 1

    const parsedAmountFC = parseEditableNumber(rawAmountFC)
    const parsedAmountLC = parseEditableNumber(rawAmountLC)

    let nextAmountFC = rawAmountFC
    let nextAmountLC = rawAmountLC

    if ((source === 'amountFC' || source === 'rate') && parsedAmountFC !== null) {
      const computedLC = rate > 0 ? parsedAmountFC / rate : 0
      nextAmountLC = Number.isFinite(computedLC) ? String(toMoney(computedLC)) : nextAmountLC
    } else if (source === 'amountLC' && parsedAmountLC !== null) {
      const computedFC = parsedAmountLC * rate
      nextAmountFC = Number.isFinite(computedFC) ? String(toMoney(computedFC)) : nextAmountFC
    }

    const amountLCForTotal = parseEditableNumber(nextAmountLC)

    return {
      ...next,
      amountFC: nextAmountFC,
      amountLC: nextAmountLC,
      vatPer: '',
      vatAmountFC: '',
      vatAmountLC: '',
      amountWithVAT: amountLCForTotal !== null ? String(toMoney(amountLCForTotal)) : '',
    }
  }

  const normalizeSettlementCurrencyCode = (value = '') => {
    const code = String(value || '').trim().toUpperCase()
    if (['SOM', 'SOMS', 'SUM'].includes(code)) return 'UZS'
    return code || 'USD'
  }

  const applySettlementAccountCurrency = (accountCode) => {
    if (!['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())) return
    const code = String(accountCode || '').trim()
    if (!code) return

    const account = activeAccounts.find((a) => getAccountCodeValue(a) === code)
    if (!account) return

    const settlementCurrency = normalizeSettlementCurrencyCode(account.currency)
    const hasCurrency = settlementCurrency === 'USD'
      || currencyOptions.some((item) => item.code === settlementCurrency)
    if (!hasCurrency) return
    if (String(header.currCode || '').trim().toUpperCase() === settlementCurrency) return

    const resolved = resolvePaymentRate(settlementCurrency)
    setHeader((prev) => ({
      ...prev,
      currCode: settlementCurrency,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }))
    setLineForm((prev) => recalcReceiptPaymentLine({
      ...prev,
      currCode: settlementCurrency,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }, 'rate'))
  }

  const handleLineTypeChange = (val) => {
    const normalized = normalizeLineType(val)
    setLF('type', normalized)
    setLF('typeCode', normalized.toUpperCase())

    const suggestedAccountCode = pickDefaultAccountCodeByType(activeAccounts, normalized)
    if (suggestedAccountCode) {
      setLF('acCode', suggestedAccountCode)
      applySettlementAccountCurrency(suggestedAccountCode)
    }

    if (normalized === 'Cash') {
      setLF('chqNo', '')
      setLF('chqDate', '')
      setLF('chqBank', '')
    }
  }

  const handleLineAcCodeChange = (val) => {
    setLF('acCode', val)
    applySettlementAccountCurrency(val)
  }

  const handleAmountFC = (val) => {
    setLineForm((prev) => recalcReceiptPaymentLine({ ...prev, amountFC: val }, 'amountFC'))
  }

  const handleAmountLC = (val) => {
    setLineForm((prev) => recalcReceiptPaymentLine({ ...prev, amountLC: val }, 'amountLC'))
  }

  const handleCurrRateChange = (val) => {
    setLineForm((prev) => recalcReceiptPaymentLine({ ...prev, currRate: val, currRateSource: 'manual' }, 'rate'))
  }

  const handleHeaderCurrRateChange = (val) => {
    const normalizedHeaderCurrency = String(header.currCode || 'USD').trim().toUpperCase()
    if (normalizedHeaderCurrency === 'USD') {
      setHeader((prev) => ({
        ...prev,
        currRate: '1.000000',
        currRateSource: 'base_currency',
      }))
      return
    }
    setHeader((prev) => ({
      ...prev,
      currRate: val,
      currRateSource: 'manual',
    }))
  }

  const handleHeaderCurrencyChange = (nextCode) => {
    const normalized = String(nextCode || 'USD').trim().toUpperCase()
    const resolved = resolvePaymentRate(normalized)
    setHeader((prev) => ({
      ...prev,
      currCode: normalized,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }))

    if (!isMetalVoucher && ['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())) {
      setLineForm((prev) => recalcReceiptPaymentLine({
        ...prev,
        currCode: normalized,
        currRate: resolved.rate.toFixed(6),
        currRateSource: resolved.source,
      }, 'rate'))
    }
  }

  const applyPartyCurrency = useCallback((resolvedParty) => {
    if (!resolvedParty) return
    if (!['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())) return

    const preferredCode = String(resolvedParty.accountCurrency || '').trim().toUpperCase()
    if (!preferredCode) return

    const hasCurrency = currencyOptions.some((item) => item.code === preferredCode)
    if (!hasCurrency) return
    if (String(header.currCode || '').trim().toUpperCase() === preferredCode) return

    const resolved = resolvePaymentRate(preferredCode)
    setHeader((prev) => ({
      ...prev,
      currCode: preferredCode,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }))
  }, [voucherType, currencyOptions, header.currCode, resolvePaymentRate, setHeader])

  const handleLineCurrencyChange = (nextCode) => {
    const normalized = String(nextCode || 'USD').trim().toUpperCase()
    const resolved = resolvePaymentRate(normalized)
    if (isMetalVoucher) {
      setLF('currCode', normalized)
      return
    }
    setLineForm((prev) => recalcReceiptPaymentLine({
      ...prev,
      currCode: normalized,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }, 'rate'))
  }

  const handleLineAmountEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!showLineForm) return
    saveLine()
  }

  return {
    openAddLine,
    openEditLine,
    deleteLine,
    handleAddLineClick,
    handleEditLineClick,
    handleDeleteLineClick,
    cancelLine,
    saveLine,
    handleLineTypeChange,
    handleLineAcCodeChange,
    handleAmountFC,
    handleAmountLC,
    handleCurrRateChange,
    handleHeaderCurrRateChange,
    handleHeaderCurrencyChange,
    applyPartyCurrency,
    handleLineCurrencyChange,
    handleLineAmountEnter,
  }
}

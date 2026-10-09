import {
  coerceVoucherDocNo,
  normalizeLineType,
  normalizeMongoIdField,
  normalizeVoucherFixingType,
  displayRateToBackendRate,
  hasMetalTransferLineQuantity,
  isMetalStockVoucherType,
  isMetalTransferVoucherType,
  isMetalProductTransferVoucherType,
} from './voucherTabShared'
import { hydrateMetalLineWeights } from './hydrateMetalLineWeights'
import { parseAmount } from '../../../utils/money'
import { getTransferSideLine } from './metalTransferCalc'

const moneyOrZero = (value) => parseAmount(value) ?? 0

/**
 * Persist create/update voucher payload for VoucherTab.
 */
export function useVoucherSave({
  formReadOnly,
  lineItems,
  showLineForm,
  lineForm,
  editingLineIdx,
  header,
  voucherType,
  isMetalVoucher,
  baseCurrencyCode,
  customers,
  vendors,
  latestMetalRates,
  totals,
  voucherUzsPerBase = 0,
  editingId,
  token,
  voucherErpApi,
  sortVouchers,
  loadVouchers,
  openVoucher,
  resolveVoucherParty,
  findPartyOptionByCode,
  setError,
  clearError,
  showMsg,
  setLineItems,
  setShowLineForm,
  setEditingLineIdx,
  setSaving,
  setVouchers,
  setMode,
}) {
  const saveVoucher = async () => {
  clearError()

  if (formReadOnly) {
    setError('Click Edit to unlock the voucher before saving changes')
    return
  }

  const normalizedVoucherType = String(voucherType || '').toLowerCase()
  const isSimpleMetalSave = isMetalTransferVoucherType(normalizedVoucherType)
  const isProductTransferSave = isMetalProductTransferVoucherType(normalizedVoucherType)

  let effectiveLineItems = [...lineItems]
  if (showLineForm && !isProductTransferSave) {
    const cashDraftBlank = !isMetalVoucher
      && !String(lineForm.amountLC || '').trim()
      && !String(lineForm.amountFC || '').trim()
    const metalDraftBlank = isMetalVoucher
      && !isSimpleMetalSave
      && !String(lineForm.stockCode || '').trim()
      && !String(lineForm.grossWeight || '').trim()
      && !String(lineForm.metalAmount || '').trim()
      && !String(lineForm.amountLC || '').trim()
    if (cashDraftBlank || metalDraftBlank) {
      // The next empty row stays open for another line and is not part of the voucher.
    } else if ((!isMetalVoucher && !String(lineForm.acCode || '').trim()) || !(isSimpleMetalSave
      ? hasMetalTransferLineQuantity(lineForm)
      : Boolean(lineForm.amountLC || lineForm.amountFC || lineForm.totalAmount || lineForm.metalAmount))) {
      setError(isSimpleMetalSave
        ? 'Complete stock/weight details and click Save Line, or cancel the open line before saving voucher'
        : 'Complete line details and click Save Line, or cancel the open line before saving voucher')
      return
    } else {
      const draftLine = {
        ...lineForm,
        type: normalizeLineType(lineForm.type),
        amountLC: isSimpleMetalSave ? '' : (lineForm.amountLC || lineForm.totalAmount || lineForm.metalAmount || ''),
        amountWithVAT: isSimpleMetalSave ? '' : (lineForm.amountWithVAT || lineForm.amountLC || lineForm.amountFC),
      }
      if (editingLineIdx !== null) {
        effectiveLineItems = effectiveLineItems.map((l, i) => (i === editingLineIdx ? draftLine : l))
      } else {
        effectiveLineItems.push(draftLine)
      }
      setShowLineForm(false)
      setEditingLineIdx(null)
    }
  }
  if (!isProductTransferSave) {
    const sharedNarration = String(header.narration || '').trim()
    effectiveLineItems = effectiveLineItems.map((line) => ({
      ...line,
      narration: sharedNarration,
    }))
  }
  if (showLineForm || !isMetalVoucher) {
    setLineItems(effectiveLineItems)
  }

  if (isProductTransferSave) {
    const fromLine = getTransferSideLine(effectiveLineItems, 'from')
    const toLine = getTransferSideLine(effectiveLineItems, 'to')
    if (!fromLine.inventoryItemId || !toLine.inventoryItemId) {
      setError('Select both From and To products')
      return
    }
    if (String(fromLine.inventoryItemId) === String(toLine.inventoryItemId)) {
      setError('From and To products must be different')
      return
    }
    if (!(parseFloat(fromLine.grossWeight) > 0) || !(parseFloat(toLine.grossWeight) > 0)) {
      setError('Enter From gross weight (To gross is calculated from pure conservation)')
      return
    }
    if (!(parseFloat(fromLine.pureWeight) > 0) || !(parseFloat(toLine.pureWeight) > 0)) {
      setError('Pure weight must be positive on From and To')
      return
    }
    effectiveLineItems = [fromLine, toLine]
  } else {
    if (!header.partyCode.trim()) { setError('Party Code is required'); return }
    if (!effectiveLineItems.length) { setError('Add at least one line item'); return }
    const resolvedPartyCheck = resolveVoucherParty(header.partyCode)
    const selectedAccountCheck = findPartyOptionByCode(header.partyCode)
    if (!resolvedPartyCheck && !selectedAccountCheck) {
      setError('Party must match a customer, vendor, or chart account')
      return
    }
  }

  const resolvedParty = isProductTransferSave ? null : resolveVoucherParty(header.partyCode)
  const selectedAccount = isProductTransferSave ? null : findPartyOptionByCode(header.partyCode)

  const partyLedgerIdFromResolved = () => {
    if (!resolvedParty) return ''
    if (resolvedParty.partyType === 'customer' && resolvedParty.customerId) {
      const c = customers.find((x) => String(x._id) === String(resolvedParty.customerId))
      return c?.ledgerAccountId?._id ? String(c.ledgerAccountId._id) : ''
    }
    if (resolvedParty.partyType === 'vendor' && resolvedParty.vendorId) {
      const vRow = vendors.find((x) => String(x._id) === String(resolvedParty.vendorId))
      return vRow?.ledgerAccountId?._id ? String(vRow.ledgerAccountId._id) : ''
    }
    return ''
  }
  const resolvedDocNo = coerceVoucherDocNo(normalizedVoucherType, header.vocNo, header.docDate)
  const normalizedHeaderCurrency = String(header.currCode || baseCurrencyCode || 'USD').trim().toUpperCase()
  const isReceiptPayment = ['receipt', 'payment'].includes(normalizedVoucherType)
  const backendHeaderRate = displayRateToBackendRate(header.currRate, normalizedHeaderCurrency, isReceiptPayment)
  const requiresReferenceRate = isReceiptPayment && normalizedHeaderCurrency !== String(baseCurrencyCode || 'USD').trim().toUpperCase()
  if (requiresReferenceRate && (!Number.isFinite(backendHeaderRate) || backendHeaderRate <= 0)) {
    setError(`Reference exchange rate is required for ${normalizedVoucherType} transactions in ${normalizedHeaderCurrency}`)
    return
  }

  const receiptPaymentDocTotal = isReceiptPayment
    ? effectiveLineItems.reduce((s, l) => s + moneyOrZero(l.amountFC), 0)
    : 0
  const resolvedDocAmount = (isSimpleMetalSave || isProductTransferSave)
    ? 0.01
    : isReceiptPayment && receiptPaymentDocTotal > 0
      ? receiptPaymentDocTotal
      : (totals.grandTotal || 0.01)

  const firstLineNarration = effectiveLineItems
    .map((line) => String(line?.narration || line?.remarks || '').trim())
    .find(Boolean) || ''

  const payload = {
    type: voucherType,
    amount: resolvedDocAmount,
    date: (isSimpleMetalSave || isProductTransferSave) ? (header.docDate || header.valueDate || header.vocDate) : (header.valueDate || header.vocDate),
    description: firstLineNarration || `${voucherType} voucher`,
    currency: isReceiptPayment ? normalizedHeaderCurrency : baseCurrencyCode,
    exchangeRate: isReceiptPayment ? backendHeaderRate : 1,
    customerId: resolvedParty?.customerId || undefined,
    vendorId: resolvedParty?.vendorId || undefined,
    voucherMeta: {
      partyCode: isProductTransferSave ? '' : header.partyCode,
      partyName: isProductTransferSave ? '' : (header.partyName || resolvedParty?.partyName || ''),
      // Never send '' — ObjectId cast fails with Server error. Metal Transfer has no party.
      partyAccountId: isProductTransferSave
        ? null
        : normalizeMongoIdField(selectedAccount?.accountId || partyLedgerIdFromResolved() || ''),
      salesman: header.salesman,
      vocNo: resolvedDocNo,
      docDate: header.docDate || null,
      valueDate: (isSimpleMetalSave || isProductTransferSave) ? (header.docDate || header.valueDate || null) : (header.valueDate || null),
      currRateSource: header.currRateSource || 'manual',
      rateMeta: {
        headerRateSource: header.currRateSource || 'manual',
        goldPrice: Number(latestMetalRates.goldPrice || 0),
        goldPriceCurrency: String(latestMetalRates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
        goldPriceUpdatedAt: latestMetalRates.updatedAt || null,
        ...(Number(voucherUzsPerBase) > 0 ? { uzsPerBase: Number(voucherUzsPerBase) } : {}),
      },
      ...(requiresReferenceRate ? { referenceExchangeRate: backendHeaderRate } : {}),
      ...(isMetalStockVoucherType(voucherType) && !isSimpleMetalSave && !isProductTransferSave ? {
        fixingType: normalizeVoucherFixingType(header.fixingType),
        metalRate: Number(header.metalRate) || 0,
      } : {}),
      lineItems: effectiveLineItems.map((l) => {
        const metalLine = isMetalStockVoucherType(voucherType) ? hydrateMetalLineWeights(l) : l
        return {
          ...metalLine,
          transferSide: metalLine.transferSide || undefined,
          inventoryItemId: normalizeMongoIdField(metalLine.inventoryItemId),
          currRateSource: metalLine.currRateSource || 'manual',
          pcs: moneyOrZero(metalLine.pcs),
          grossWeight: moneyOrZero(metalLine.grossWeight),
          purity: moneyOrZero(metalLine.purity),
          pureWeight: moneyOrZero(metalLine.pureWeight),
          metalAmount: moneyOrZero(metalLine.metalAmount),
          metalRate: moneyOrZero(metalLine.metalRate),
          amountFC: moneyOrZero(metalLine.amountFC),
          amountLC: moneyOrZero(metalLine.amountLC),
          headerAmt: moneyOrZero(metalLine.headerAmt),
          currRate: displayRateToBackendRate(metalLine.currRate, metalLine.currCode || header.currCode, isReceiptPayment),
          ...(metalLine.referenceRate ? { referenceRate: displayRateToBackendRate(metalLine.referenceRate, metalLine.currCode || header.currCode, isReceiptPayment) } : {}),
          vatPer: moneyOrZero(metalLine.vatPer),
          vatAmountFC: moneyOrZero(metalLine.vatAmountFC),
          vatAmountLC: moneyOrZero(metalLine.vatAmountLC),
          amountWithVAT: moneyOrZero(metalLine.amountWithVAT) || moneyOrZero(metalLine.amountLC),
          headerAmountWithVAT: moneyOrZero(metalLine.headerAmountWithVAT),
        }
      }),
    },
    ...(isMetalStockVoucherType(voucherType) && !isSimpleMetalSave && !isProductTransferSave
      ? { metalFixStatus: normalizeVoucherFixingType(header.fixingType) === 'non-fixing' ? 'unfixed' : 'fixed' }
      : {}),
  }
  const payloadLineTotal = isReceiptPayment && receiptPaymentDocTotal > 0
    ? receiptPaymentDocTotal
    : effectiveLineItems.reduce((s, l) => s + (moneyOrZero(l.amountWithVAT) || moneyOrZero(l.amountLC)), 0)
  const baseCode = String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD'
  const headerDisplayRate = Number(header.currRate) || 0
  const postHeaderForeignAmount = !isReceiptPayment
    && !isSimpleMetalSave
    && !isProductTransferSave
    && normalizedHeaderCurrency !== baseCode
    && headerDisplayRate > 0
    && payloadLineTotal > 0
  if (postHeaderForeignAmount) {
    // Ledger stays in USD (foreign amount × USD-per-unit). The statement keeps the som figure from this rate.
    payload.currency = normalizedHeaderCurrency
    payload.exchangeRate = displayRateToBackendRate(header.currRate, normalizedHeaderCurrency, true)
    payload.amount = Math.round(payloadLineTotal * headerDisplayRate * 100) / 100
  } else {
    payload.amount = (isSimpleMetalSave || isProductTransferSave) ? 0.01 : (payloadLineTotal || 0.01)
  }
  setSaving(true)
  try {
    let savedId = editingId
    if (editingId) {
      await voucherErpApi.updateTransaction(token, editingId, payload)
      showMsg('Voucher updated successfully')
    } else {
      const res = await voucherErpApi.createTransaction(token, payload)
      savedId = res?.transaction?._id || null
      showMsg('Voucher saved successfully')
    }
    await loadVouchers()
    const res2 = await voucherErpApi.getTransactions(token, { type: voucherType, limit: 200 })
    const refreshed = sortVouchers(
      (res2.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
      voucherType
    )
    setVouchers(refreshed)
    // Open the voucher that was just saved/updated
    const toOpen = savedId
      ? refreshed.find(t => t._id === savedId)
      : refreshed[refreshed.length - 1]
    if (toOpen) {
      openVoucher(toOpen)
    } else if (refreshed.length > 0) {
      openVoucher(refreshed[refreshed.length - 1])
    } else {
      setMode('list')
    }
  } catch (e) {
    setError(e.response?.data?.message || 'Failed to save voucher')
  } finally {
    setSaving(false)
  }
}

  return { saveVoucher }
}

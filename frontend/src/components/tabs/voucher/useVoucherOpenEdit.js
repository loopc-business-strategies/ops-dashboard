import {
  emptyHeader,
  coerceVoucherDocNo,
  normalizeLineType,
  backendRateToDisplayRate,
  normalizeVoucherFixingType,
  today,
} from './voucherTabShared'
import { isVoucherTypeEnabled } from '../../../config/tenantBranding'

/**
 * Open/create/switch voucher flows for VoucherTab.
 */
export function useVoucherOpenEdit({
  mode,
  editingId,
  header,
  lineItems,
  voucherType,
  tenantKey,
  lastViewedIdRef,
  buildFormSnapshot,
  fetchServerNextVocNo,
  resolveNextVocNo,
  sortVouchers,
  voucherErpApi,
  token,
  setEditingId,
  setHeader,
  setSelectedPartyId,
  setRecentPartyVouchers,
  setLineItems,
  setShowLineForm,
  setMenuTab,
  setWorkflowNote,
  setModalOffset,
  setModalDrag,
  setError,
  setMode,
  setVouchers,
  setVoucherType,
  loadVouchers,
  resolveVoucherParty,
  findPartyOptionByCode,
  initialFormSnapshotRef,
}) {
  const openVoucher = (v) => {
  const m = v.voucherMeta || {}
  const resolvedParty = resolveVoucherParty(m.partyCode || '')
  const voucherCurrency = String(v.currency || 'USD').trim().toUpperCase()
  const isAedVoucher = voucherCurrency === 'AED'
  const voucherKind = String(v?.type || voucherType || '').trim().toLowerCase()
  const isReceiptPaymentVoucher = voucherKind === 'receipt' || voucherKind === 'payment'
  const headerRateSource = m.currRateSource || m.rateMeta?.headerRateSource || 'manual'
  const loadedRate = parseFloat(v.exchangeRate)
  const normalizedHeaderRate = backendRateToDisplayRate(loadedRate, voucherCurrency, isReceiptPaymentVoucher)
  const nextHeader = {
    branch: m.branch || '',
    partyCode: m.partyCode || '',
    partyName: m.partyName || '',
    currCode: voucherCurrency,
    currRate: normalizedHeaderRate.toFixed(6),
    currRateSource: isAedVoucher ? 'fixed_aed' : headerRateSource,
    vocDate: v.date ? v.date.slice(0, 10) : today(),
    vocNo: coerceVoucherDocNo(voucherKind, m.vocNo, m.docDate ? m.docDate.slice(0, 10) : (v.date ? v.date.slice(0, 10) : today())),
    salesman: m.salesman || '',
    docDate: m.docDate ? m.docDate.slice(0, 10) : (v.date ? v.date.slice(0, 10) : today()),
    valueDate: m.valueDate ? m.valueDate.slice(0, 10) : (v.date ? v.date.slice(0, 10) : today()),
    fixingType: normalizeVoucherFixingType(m.fixingType),
  }
  let nextPartyId = m.partyAccountId
    ? `account:${String(m.partyAccountId)}`
    : ''
  const cid = v.customerId && (typeof v.customerId === 'object' && v.customerId._id ? v.customerId._id : v.customerId)
  const vid = v.vendorId && (typeof v.vendorId === 'object' && v.vendorId._id ? v.vendorId._id : v.vendorId)
  if (!nextPartyId && cid) nextPartyId = `customer:${String(cid)}`
  if (!nextPartyId && vid) nextPartyId = `vendor:${String(vid)}`
  if (!nextPartyId) nextPartyId = resolvedParty?.partyId || findPartyOptionByCode(m.partyCode || '')?.id || ''
  const nextLineItems = (m.lineItems || []).map((line) => {
    const lineCurrency = String(line?.currCode || voucherCurrency || 'USD').trim().toUpperCase()
    const lineRateSource = line?.currRateSource || 'manual'
    const lineRate = parseFloat(line?.currRate)
    const normalizedLineRate = backendRateToDisplayRate(lineRate, lineCurrency, isReceiptPaymentVoucher)
    return {
      ...line,
      inventoryItemId: line.inventoryItemId ? String(line.inventoryItemId._id || line.inventoryItemId) : '',
      type: normalizeLineType(line.type),
      currCode: lineCurrency,
      currRate: normalizedLineRate.toFixed(6),
      currRateSource: (lineCurrency === 'AED' && isReceiptPaymentVoucher) ? 'fixed_aed' : lineRateSource,
    }
  })
  setEditingId(v._id)
  setHeader(nextHeader)
  setSelectedPartyId(nextPartyId)
  setLineItems(nextLineItems)
  setShowLineForm(false)
  setMenuTab('header')
  setWorkflowNote('')
  setError('')
  setMode('view')
  initialFormSnapshotRef.current = buildFormSnapshot(nextHeader, nextLineItems, nextPartyId)
}

  const openCreate = async (freshList, forcedType = voucherType) => {
  // If already filling a new form, ask before discarding
  if (mode === 'create' && !editingId) {
    const hasData = String(header.partyCode || '').trim() || lineItems.length > 0 || String(header.narration || '').trim()
    if (hasData && !window.confirm('Discard current unsaved form and open a new one?')) return
    // Don’t overwrite lastViewedIdRef — it already points to the voucher before the first New
  } else {
    // Only update the back-reference when coming from a real saved voucher
    if (editingId) lastViewedIdRef.current = editingId
  }
  const baseHeader = emptyHeader()
  const serverVocNo = await fetchServerNextVocNo(forcedType, baseHeader.docDate)
  const nextHeader = {
    ...baseHeader,
    vocNo: serverVocNo || resolveNextVocNo(freshList, forcedType, baseHeader.docDate),
  }
  setEditingId(null)
  setHeader(nextHeader)
  setSelectedPartyId('')
  setRecentPartyVouchers([])
  setLineItems([])
  setShowLineForm(false)
  setMenuTab('header')
  setWorkflowNote('')
  setModalOffset({ x: 0, y: 0 })
  setModalDrag(null)
  setError('')
  setMode('create')
  initialFormSnapshotRef.current = buildFormSnapshot(nextHeader, [], '')
}

const openLastOrCreate = async (type) => {
  try {
    const res = await voucherErpApi.getTransactions(token, { type, limit: 200 })
    const txs = sortVouchers(
      (res.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
      type
    )
    setVouchers(txs)
    if (txs.length > 0) {
      openVoucher(txs[txs.length - 1])
    } else {
      openCreate(txs, type)
    }
  } catch {
    openCreate(undefined, type)
  }
}

const switchVoucherTab = async (type) => {
  if (!isVoucherTypeEnabled(tenantKey, type)) return
  if (type === voucherType && mode === 'list') {
    await loadVouchers()
    return
  }
  if (mode === 'create' && !editingId) {
    const hasData = String(header.partyCode || '').trim() || lineItems.length > 0 || String(header.narration || '').trim()
    if (hasData && !window.confirm('Discard current unsaved form and switch voucher type?')) return
  }
  setVoucherType(type)
  await openLastOrCreate(type)
}

  return { openVoucher, openCreate, openLastOrCreate, switchVoucherTab }
}

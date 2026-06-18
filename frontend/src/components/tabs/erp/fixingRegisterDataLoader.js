import erpAccountingAPI from '../../../api/erp-accounting'
import { fixingRegConvertToOz } from './fixingRegisterUtils'

const fetchAllPages = async (fetchFn, key, limit = 200) => {
  const allRows = []
  let page = 1
  let total = 0
  do {
    const data = await fetchFn({ page, limit })
    const chunk = Array.isArray(data?.[key]) ? data[key] : []
    allRows.push(...chunk)
    total = Number(data?.total || chunk.length)
    if (!chunk.length) break
    page += 1
  } while (allRows.length < total)
  return allRows
}

const resolveVoucherLineMetalCode = (line = {}) => {
  const raw = String(line.stockCode || line.productType || line.narration || '').trim().toUpperCase()
  if (!raw) return ''
  if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
  if (raw.includes('XAG') || raw.includes('SILVER')) return 'XAG'
  if (raw.includes('XPT') || raw.includes('PLATINUM')) return 'XPT'
  if (raw.includes('XPD') || raw.includes('PALLADIUM')) return 'XPD'
  return ''
}

const resolveDirectDealMetalCode = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (!raw) return ''
  if (raw === 'XAU' || raw.includes('GOLD')) return 'XAU'
  if (raw === 'XAG' || raw.includes('SILV')) return 'XAG'
  if (raw === 'XPT' || raw.includes('PLAT')) return 'XPT'
  if (raw === 'XPD' || raw.includes('PALL')) return 'XPD'
  return raw
}

function buildFixingRegisterRows({
  txSales = [],
  txPurchases = [],
  directDeals = [],
  fixingRegFilter,
  matchesSelectedMetal,
  isAllMetalSelection,
}) {
  const rows = []
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const toValidNumber = (value) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  const resolveUnfixAmount = (line = {}) => {
    const premium = toValidNumber(line.premiumAmount)
      ?? toValidNumber(line.premiumAmt)
      ?? toValidNumber(line.premium)
      ?? toValidNumber(line.premiumValueAmount)
    if (premium !== null) return premium
    const total = toValidNumber(line.totalAmount) ?? toValidNumber(line.amountLC)
    const metal = toValidNumber(line.metalAmount)
    if (total !== null && metal !== null) return total - metal
    return 0
  }
  const txRows = [...txSales, ...txPurchases]
  for (const tx of txRows) {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    const txFixingTypeRaw = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
    const txFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(txFixingTypeRaw) ? 'Unfixing' : 'Fixing'
    const voucherNo = String(tx?.voucherMeta?.vocNo || tx?.voucherMeta?.refNo || tx?._id || '').trim()
    const branch = tx?.voucherMeta?.branch || 'HO'
    const partyName = tx?.customerId?.name || tx?.vendorId?.name || tx?.voucherMeta?.partyName || '—'
    const docDate = tx?.voucherMeta?.docDate || tx?.date || null
    const valueDate = tx?.voucherMeta?.valueDate || tx?.date || null
    if (fixingRegFilter.excludeFutures && valueDate && new Date(valueDate) > today) continue
    if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
      if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
    }
    if (!lines.length) {
      if (!isAllMetalSelection) continue
      if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(String(tx?.description || ''))) continue
      rows.push({
        rowId: `${tx._id}-0`,
        sourceType: 'Voucher',
        voucherNo,
        docDate,
        valueDate,
        branch,
        customerName: partyName,
        direction: tx.type === 'purchase' ? 'buy' : 'sell',
        metal: '',
        qty: 0,
        price: Number(tx?.voucherMeta?.metalRate || 0),
        amount: Number(tx?.amount || 0),
        dealStatus: tx?.status || 'draft',
        remarks: tx?.description || '',
        fixingMode: txFixingMode,
        groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
      })
      continue
    }
    lines.forEach((line, idx) => {
      const lineMetal = resolveVoucherLineMetalCode(line)
      if (!matchesSelectedMetal(lineMetal)) return
      const narration = String(line.narration || tx?.description || '')
      const pureWeightGram = Number(line.pureWeight || line.grossWeight || 0)
      const qtyOz = pureWeightGram > 0 ? (pureWeightGram / 31.1034768) : 0
      if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(narration)) return
      rows.push({
        rowId: `${tx._id}-${idx}`,
        sourceType: 'Voucher',
        voucherNo,
        docDate,
        valueDate,
        branch,
        customerName: partyName,
        direction: tx.type === 'purchase' ? 'buy' : 'sell',
        metal: lineMetal || '',
        qty: qtyOz,
        price: Number(line.metalRate || tx?.voucherMeta?.metalRate || 0),
        amount: txFixingMode === 'Unfixing'
          ? resolveUnfixAmount(line)
          : Number(line.totalAmount || line.amountLC || tx?.amount || 0),
        dealStatus: tx?.status || 'draft',
        remarks: narration,
        fixingMode: txFixingMode,
        groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
      })
    })
  }
  for (const deal of directDeals) {
    if (deal.isDeleted) continue
    if (fixingRegFilter.status === 'final' && deal.status !== 'confirmed') continue
    const dealEntryType = String(deal.entryType || 'fixing').trim().toLowerCase()
    const dealFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfixing'].includes(dealEntryType) ? 'Unfixing' : 'Fixing'
    const dealDocDate = new Date(deal.docDate)
    const dealValueDate = new Date(deal.valueDate)
    if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(deal.remarks || '')) continue
    if (fixingRegFilter.excludeFutures && dealValueDate > today) continue
    for (const line of deal.lineItems || []) {
      const lineMetal = resolveDirectDealMetalCode(line.metal || 'XAU')
      if (!matchesSelectedMetal(lineMetal)) continue
      const qtyOz = fixingRegConvertToOz(Number(line.qty || 0), line.stockCode || 'OZ')
      const partyName = line.customerName || '—'
      if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
        if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
      }
      const groupKey =
        fixingRegFilter.groupBy === 'customer' ? (partyName)
        : fixingRegFilter.groupBy === 'branch' ? (deal.branch || 'HO')
        : fixingRegFilter.groupBy === 'valuedate' ? new Date(deal.valueDate).toISOString().slice(0, 10)
        : 'All'
      rows.push({
        rowId: `${deal._id}-${line._id || Math.random().toString(36).slice(2, 8)}`,
        sourceType: 'Fixing Deal',
        voucherNo: deal.docNo,
        docDate: dealDocDate,
        valueDate: dealValueDate,
        branch: deal.branch || 'HO',
        dealStatus: deal.status,
        remarks: deal.remarks || '',
        direction: line.direction,
        metal: lineMetal || 'XAU',
        qty: qtyOz,
        eqOz: Number(line.eqOz || 0),
        stockCode: (line.stockCode || 'OZ').toUpperCase(),
        price: Number(line.price || 0),
        amount: Number(line.amount || 0),
        customerName: partyName,
        customerCode: line.customerCode || '',
        fixingMode: dealFixingMode,
        groupKey,
      })
    }
  }
  rows.sort((a, b) => {
    const orderBy = fixingRegFilter.orderBy || 'voucherNo'
    if (orderBy === 'docDate' || orderBy === 'valueDate') {
      const dateKey = orderBy
      const dateCompare = new Date(a[dateKey] || 0) - new Date(b[dateKey] || 0)
      if (dateCompare !== 0) return dateCompare
    }
    const aVoucher = String(a.voucherNo || '')
    const bVoucher = String(b.voucherNo || '')
    const voucherCompare = aVoucher.localeCompare(bVoucher, undefined, { numeric: true, sensitivity: 'base' })
    if (voucherCompare !== 0) return voucherCompare
    return new Date(a.docDate || 0) - new Date(b.docDate || 0)
  })
  return rows
}

/** Fetch transactions + direct deals and build fixing register rows for the current filter. */
export async function loadFixingRegisterData({ token, fixingRegFilter }) {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const fromDate = fixingRegFilter.fromDate ? new Date(`${fixingRegFilter.fromDate}T00:00:00`) : null
  const openingEndDate = fromDate ? new Date(fromDate.getTime() - 86400000) : null
  const selectedMetalCode = String(fixingRegFilter.metalType || '').split('::')[0].toUpperCase()
  const primaryMetalCodes = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
  const isAllMetalSelection = !selectedMetalCode || selectedMetalCode === 'ALL'
  const isOtherMetalSelection = selectedMetalCode === 'OTHER'
  const matchesSelectedMetal = (metalCodeRaw) => {
    const metalCode = String(metalCodeRaw || '').toUpperCase()
    if (isAllMetalSelection) return true
    if (isOtherMetalSelection) return metalCode && !primaryMetalCodes.has(metalCode)
    return metalCode === selectedMetalCode
  }
  const baseTxParams = {
    startDate: fixingRegFilter.fromDate,
    endDate: fixingRegFilter.toDate,
  }
  const openingTxParams = openingEndDate ? {
    endDate: openingEndDate.toISOString().slice(0, 10),
  } : null
  if (fixingRegFilter.status === 'final') baseTxParams.status = 'posted'
  if (openingTxParams && fixingRegFilter.status === 'final') openingTxParams.status = 'posted'
  const [saleTxs, purchaseTxs, deals, openingSaleTxs, openingPurchaseTxs, openingDeals] = await Promise.all([
    fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'sale' }), 'transactions', 200),
    fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'purchase' }), 'transactions', 200),
    fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
      ...p,
      startDate: fixingRegFilter.fromDate,
      endDate: fixingRegFilter.toDate,
      ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
    }), 'deals', 100),
    openingTxParams
      ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'sale' }), 'transactions', 200)
      : Promise.resolve([]),
    openingTxParams
      ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'purchase' }), 'transactions', 200)
      : Promise.resolve([]),
    openingTxParams
      ? fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
        ...p,
        endDate: openingEndDate.toISOString().slice(0, 10),
        ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
      }), 'deals', 100)
      : Promise.resolve([]),
  ])
  const buildCtx = { fixingRegFilter, matchesSelectedMetal, isAllMetalSelection }
  const openingRows = fixingRegFilter.excludeOpeningBalance
    ? []
    : buildFixingRegisterRows({ txSales: openingSaleTxs, txPurchases: openingPurchaseTxs, directDeals: openingDeals, ...buildCtx })
  const rows = buildFixingRegisterRows({ txSales: saleTxs, txPurchases: purchaseTxs, directDeals: deals, ...buildCtx })
  const openingQtyOz = openingRows.reduce((sum, row) => {
    const mode = String(row?.fixingMode || '').trim().toLowerCase()
    if (mode === 'unfixing') return sum
    const qty = Number(row.qty || 0)
    const sign = String(row.direction || '').toLowerCase() === 'buy' ? 1 : -1
    return sum + (sign * qty)
  }, 0)
  const getRowSignedAmount = (row) => {
    const amount = Number(row?.amount || 0)
    const mode = String(row?.fixingMode || '').trim().toLowerCase()
    if (mode === 'unfixing') return amount
    const sign = String(row?.direction || '').toLowerCase() === 'buy' ? 1 : -1
    return sign * amount
  }
  const openingValue = openingRows.reduce((sum, row) => sum + getRowSignedAmount(row), 0)
  return {
    rows,
    opening: { qtyOz: openingQtyOz, value: openingValue },
  }
}

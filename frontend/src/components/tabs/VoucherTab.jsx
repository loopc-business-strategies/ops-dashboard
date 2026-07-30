import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { ACCOUNT_TYPES } from '../../constants/accountTypes'
import { isMasterDocumentSettingsEnabled } from '../../config/tenantBranding'
import { resolveErpUserTenantKey } from './erp/resolveErpUserTenant'
import { startMetalRatesRealtime } from '../../utils/realtimeSocket'
import { buildMetalRatesFromApiPayload } from '../../utils/liveMetalRates'
import { fmt, S, btn, tabBtn, emptyLine, emptyHeader, normalizeLookupValue, normalizeLineType, FIXED_AED_RATE, backendRateToDisplayRate, normalizeRateType, formatPartyAddress, decodeInventoryCategoryMeta, toTitle, getAccountCodeValue, isMetalStockVoucherType, isMetalTransferVoucherType, hasMetalTransferLineQuantity, sortVouchersByDocNo, nextVocNo, displayVoucherDocNo } from './voucher/voucherTabShared'
import { useVoucherReferenceData } from './voucher/useVoucherReferenceData'
import { useVoucherLineAutoCalc } from './voucher/useVoucherLineAutoCalc'
import { useVoucherLineForm } from './voucher/useVoucherLineForm'
import { useVoucherOpenEdit } from './voucher/useVoucherOpenEdit'
import { useVoucherToolbarNav } from './voucher/useVoucherToolbarNav'
import { useVoucherSave } from './voucher/useVoucherSave'
import { runVoucherWorkflowAction } from './voucher/voucherErpApi'
import { BASE } from '../../api/erp-accounting/client'
import { buildVoucherTypeConfigs } from './voucher/voucherTypeConfigs'
import VoucherListPanel from './voucher/VoucherListPanel'
import { useVoucherPrintModel } from './voucher/useVoucherPrintModel'
import VoucherPrintPanel from './voucher/VoucherPrintPanel'
import { VOUCHER_PRINT_MEDIA_CSS } from './voucher/voucherPrintStyles'
import VoucherPreviewModal from './voucher/VoucherPreviewModal'
import VoucherEditorPanel from './voucher/VoucherEditorPanel'
import { useVoucherPendingOpen } from './voucher/useVoucherPendingOpen'
import {
  filterActiveAccounts,
  filterActiveCustomers,
  filterActiveVendors,
  filterPartyAccounts,
} from './erp/accountDropdownHelpers'
import { useVoucherTabAccess } from './voucher/useVoucherTabAccess'
import { includesSearchTerm, matchesYearMonths, normalizeFilterMonths, normalizeFilterYear, toMonthCsv } from './erp/erpListFilters'

export default function VoucherTab({
  token,
  user,
  accounts = [],
  customers: propCustomers = [],
  vendors: propVendors = [],
  currencies = [],
  reportBranding = null,
  pendingOpenTransactionId = null,
  pendingOpenTransactionType = null,
  onPendingOpenTransactionConsumed = null,
  erpAdvancedListFiltersEnabled = false,
}) {
  const showAccountDetailsTab = false
  const { t } = useLanguage()
  const {
    erpAccess: _erpAccess,
    tenantKey,
    enabledVoucherTypes,
    isSuperAdmin,
    isFinance,
    isManagementOnly: _isManagementOnly,
    canManageWorkflow,
    canView,
    canCreatePayment,
    canCreateReceipt,
    canCreatePurchase,
    canCreateSale,
    canCreateMetalReceipt,
    canCreateMetalPayment,
    isReadOnly,
  } = useVoucherTabAccess(user)

  // ─── top-level state ────────────────────────────────────────────────────────
  const [voucherType, setVoucherType] = useState(() => enabledVoucherTypes[0] || 'payment')
  const isMetalVoucher = isMetalStockVoucherType(voucherType)
  const isSimpleMetalVoucher = isMetalTransferVoucherType(voucherType)
  const [showVoucherPreview, setShowVoucherPreview] = useState(false)
  const voucherPreviewEnabled = isMasterDocumentSettingsEnabled(tenantKey)

  // ─── own customers/vendors state (always fresh, not stale props) ─────────────
  const [localCustomers, setLocalCustomers] = useState(propCustomers)
  const [localVendors, setLocalVendors] = useState(propVendors)
  const [localCurrencies, setLocalCurrencies] = useState(Array.isArray(currencies) ? currencies : [])
  const [latestMetalRates, setLatestMetalRates] = useState({ goldPrice: 0, silverPrice: 0, priceCurrency: 'USD', updatedAt: null })
  const customers = localCustomers.length > 0 ? localCustomers : propCustomers
  const vendors = localVendors.length > 0 ? localVendors : propVendors
  const activeCustomers = filterActiveCustomers(customers)
  const activeVendors = filterActiveVendors(vendors)
  const activeAccounts = filterActiveAccounts(accounts)
  const partyChartAccounts = filterPartyAccounts(accounts)
  const mergedCurrencies = localCurrencies.length > 0 ? localCurrencies : (Array.isArray(currencies) ? currencies : [])
  const currencyOptions = mergedCurrencies
    .filter((item) => String(item?.code || '').trim())
    .filter((item) => item.isActive !== false)
    .map((item) => ({
      code: String(item.code || '').trim().toUpperCase(),
      name: String(item.name || '').trim(),
      exchangeRate: Number(item.exchangeRate || 1),
      isActive: item.isActive !== false,
      baseCurrency: Boolean(item.baseCurrency),
    }))
    .sort((a, b) => {
      if (a.baseCurrency !== b.baseCurrency) return a.baseCurrency ? -1 : 1
      return a.code.localeCompare(b.code)
    })
  const baseCurrencyCode = String(currencyOptions.find((item) => item.baseCurrency)?.code || 'USD').trim().toUpperCase() || 'USD'

  const getCurrencyRateByCode = useCallback((code) => {
    const normalized = String(code || '').trim().toUpperCase()
    const selected = currencyOptions.find((item) => item.code === normalized)
    const rate = Number(selected?.exchangeRate || 1)
    return Number.isFinite(rate) && rate > 0 ? rate : 1
  }, [currencyOptions])

  const { refreshParties, refreshCurrencies, refreshMetalRates, voucherErpApi } = useVoucherReferenceData({
    token,
    setLocalCustomers,
    setLocalVendors,
    setLocalCurrencies,
    setLatestMetalRates,
  })

  useEffect(() => {
    if (canView) refreshParties()
  }, [canView, refreshParties])
  useEffect(() => {
    if (canView) refreshCurrencies()
  }, [canView, refreshCurrencies])
  useEffect(() => {
    if (canView) refreshMetalRates()
  }, [canView, refreshMetalRates])

  useEffect(() => {
    if (!canView || !token) return undefined
    const tenant = resolveErpUserTenantKey(user)
    return startMetalRatesRealtime({
      token,
      tenant,
      onRatesUpdate: (payload) => {
        const rates = payload?.rates || payload?.data?.rates
        if (rates) setLatestMetalRates(buildMetalRatesFromApiPayload(rates))
      },
    })
  }, [canView, token, user])
  const [vouchers, setVouchers] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('list')            // 'list' | 'create' | 'view'
  const formReadOnly = isReadOnly || mode === 'view'
  const [editingId, setEditingId] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('') // workflow filter
  const [voucherSearch, setVoucherSearch] = useState('')
  const [voucherFilterYear, setVoucherFilterYear] = useState('')
  const [voucherFilterMonths, setVoucherFilterMonths] = useState([])
  const [menuTab, setMenuTab] = useState('header')        // 'header' | 'accounts' | 'lineItems' | 'attachments'
  const [workflowNote, setWorkflowNote] = useState('')
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [recentPartyVouchers, setRecentPartyVouchers] = useState([])
  const [loadingRecentPartyVouchers, setLoadingRecentPartyVouchers] = useState(false)
  const [attachmentInputKey, setAttachmentInputKey] = useState(0)
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 })
  const [modalDrag, setModalDrag] = useState(null)
  const dragMetaRef = useRef({ moved: false })
  const lastViewedIdRef = useRef(null)  // tracks the voucher open before New was clicked
  const openVoucherRef = useRef(null)
  const initialFormSnapshotRef = useRef('')

  // ─── header form ────────────────────────────────────────────────────────────
  const [header, setHeader] = useState(emptyHeader())
  const setHdr = (key, value) => setHeader((prev) => ({ ...prev, [key]: value }))

  const voucherConfigs = buildVoucherTypeConfigs(t)

  const resolveVoucherParty = useCallback((partyCode) => {
    const lookupValue = normalizeLookupValue(partyCode)
    if (!lookupValue) return null

    const vendorMatch = activeVendors.find((item) => {
      const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
      return lookupValue === normalizeLookupValue(item._id)
        || lookupValue === normalizeLookupValue(item.vendorCode)
        || lookupValue === ledgerCode
    })

    const customerMatch = activeCustomers.find((item) => {
      const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
      return lookupValue === normalizeLookupValue(item._id) || lookupValue === ledgerCode
    })

    const toVendor = (vendor) => ({
      customerId: '',
      vendorId: vendor._id,
      partyName: vendor.name || '',
      partyCode: vendor.vendorCode || vendor.ledgerAccountId?.accountCode || String(vendor._id),
      partyId: `vendor:${String(vendor._id)}`,
      partyType: 'vendor',
      accountCurrency: String(vendor.ledgerAccountId?.currency || vendor.currency || '').trim().toUpperCase(),
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: formatPartyAddress(vendor.address, vendor.city, vendor.country, vendor.postalCode),
    })

    const toCustomer = (customer) => ({
      customerId: customer._id,
      vendorId: '',
      partyName: customer.name || '',
      partyCode: customer.ledgerAccountId?.accountCode || String(customer._id),
      partyId: `customer:${String(customer._id)}`,
      partyType: 'customer',
      accountCurrency: String(customer.ledgerAccountId?.currency || customer.currency || '').trim().toUpperCase(),
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })

    // Sale/receipt: prefer customer (counterparty is usually buyer). Purchase/payment: prefer vendor (supplier).
    const preferCustomerFirst = voucherType === 'sale' || voucherType === 'receipt' || voucherType === 'metal_payment'
    if (preferCustomerFirst) {
      if (customerMatch) return toCustomer(customerMatch)
      if (vendorMatch) return toVendor(vendorMatch)
    } else {
      if (vendorMatch) return toVendor(vendorMatch)
      if (customerMatch) return toCustomer(customerMatch)
    }
    return null
  }, [activeCustomers, activeVendors, voucherType])

  const PARTY_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
  const partyOptions = partyChartAccounts
    .map((account) => {
      const code = getAccountCodeValue(account)
      const name = String(account?.accountName || account?.name || '').trim()
      return {
        id: `account:${String(account?._id || code)}`,
        accountId: String(account?._id || code),
        label: `${code}${name ? ` - ${name}` : ''}`,
        partyCode: code,
        partyName: name,
        accountType: String(account?.accountType || 'Other').trim() || 'Other',
      }
    })
    .filter((item) => Boolean(item.partyCode))
    .sort((a, b) => {
      const ai = PARTY_TYPE_ORDER.indexOf(a.accountType)
      const bi = PARTY_TYPE_ORDER.indexOf(b.accountType)
      const tc = (ai === -1 ? PARTY_TYPE_ORDER.length : ai) - (bi === -1 ? PARTY_TYPE_ORDER.length : bi)
      if (tc !== 0) return tc
      return String(a.partyCode).localeCompare(String(b.partyCode))
    })

  const partyGroupedOptions = partyOptions.reduce((groups, item) => {
    const type = item.accountType
    const existing = groups.find((g) => g.type === type)
    if (existing) existing.items.push(item)
    else groups.push({ type, items: [item] })
    return groups
  }, [])

  const partyComboGroups = partyGroupedOptions.map((g) => ({
    label: g.type,
    options: g.items.map((item) => ({ value: item.id, label: item.label })),
  }))

  const metalPartyComboGroups = partyComboGroups

  const findPartyOptionByCode = useCallback((code) => {
    const lookupValue = normalizeLookupValue(code)
    if (!lookupValue) return null
    return partyOptions.find((item) => (
      lookupValue === normalizeLookupValue(item.partyCode)
      || lookupValue === normalizeLookupValue(item.partyName)
    )) || null
  }, [partyOptions])

  const LINE_ACCOUNT_TYPE_ORDER = ACCOUNT_TYPES
  const lineAccountComboGroups = (() => {
    const accountList = activeAccounts
      .map((a) => ({
        code: getAccountCodeValue(a),
        name: String(a?.accountName || a?.name || '').trim(),
        accountType: String(a?.accountType || 'Other').trim(),
      }))
      .filter((a) => a.code)
      .sort((a, b) => {
        const ai = LINE_ACCOUNT_TYPE_ORDER.indexOf(a.accountType)
        const bi = LINE_ACCOUNT_TYPE_ORDER.indexOf(b.accountType)
        const tc = (ai === -1 ? LINE_ACCOUNT_TYPE_ORDER.length : ai) - (bi === -1 ? LINE_ACCOUNT_TYPE_ORDER.length : bi)
        if (tc !== 0) return tc
        return a.code.localeCompare(b.code)
      })
    const groupMap = {}
    accountList.forEach((item) => {
      if (!groupMap[item.accountType]) groupMap[item.accountType] = []
      groupMap[item.accountType].push({ value: item.code, label: `${item.code}${item.name ? ` - ${item.name}` : ''}` })
    })
    return LINE_ACCOUNT_TYPE_ORDER
      .filter((type) => groupMap[type])
      .map((type) => ({ label: type, options: groupMap[type] }))
  })()

  const loadRecentPartyVouchers = useCallback(async (resolvedParty) => {
    if (!resolvedParty || (!resolvedParty.customerId && !resolvedParty.vendorId)) {
      setRecentPartyVouchers([])
      return
    }

    setLoadingRecentPartyVouchers(true)
    try {
      const params = {
        limit: 5,
        type: voucherType,
      }
      if (resolvedParty.customerId) params.customerId = resolvedParty.customerId
      if (resolvedParty.vendorId) params.vendorId = resolvedParty.vendorId

      const response = await voucherErpApi.getTransactions(token, params)

      const items = (response.transactions || [])
        .filter((item) => item.voucherMeta?.vocNo)
        .slice(0, 5)
        .map((item) => ({
          id: item._id,
          vocNo: item.voucherMeta?.vocNo || '-',
          date: item.date ? String(item.date).slice(0, 10) : '-',
          amount: Number(item.amount || 0),
          currency: item.currency || 'USD',
          type: item.type || '-',
          status: item.status || 'draft',
        }))

      setRecentPartyVouchers(items)
    } catch {
      setRecentPartyVouchers([])
    } finally {
      setLoadingRecentPartyVouchers(false)
    }
  }, [voucherType, token, voucherErpApi])

  // ─── line items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState([])
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLineIdx, setEditingLineIdx] = useState(null)
  const [lineForm, setLineForm] = useState(emptyLine())
  const setLF = (k, v) => setLineForm(prev => ({ ...prev, [k]: k === 'rateType' ? normalizeRateType(v) : v }))

  const resolvePaymentRate = useCallback((currencyCode) => {
    const normalized = String(currencyCode || 'USD').trim().toUpperCase()
    if (normalized === 'USD') {
      return { rate: 1, source: 'base_currency' }
    }
    if (normalized === 'AED') {
      return { rate: FIXED_AED_RATE, source: 'fixed_aed' }
    }
    const fallbackRate = getCurrencyRateByCode(normalized)
    const displayRate = backendRateToDisplayRate(fallbackRate, normalized, true)
    return { rate: displayRate, source: 'currency_table' }
  }, [getCurrencyRateByCode])

  const buildFormSnapshot = useCallback((snapshotHeader, snapshotLineItems, snapshotPartyId) => JSON.stringify({
    header: {
      branch: String(snapshotHeader?.branch || ''),
      partyCode: String(snapshotHeader?.partyCode || ''),
      partyName: String(snapshotHeader?.partyName || ''),
      currCode: String(snapshotHeader?.currCode || ''),
      currRate: String(snapshotHeader?.currRate || ''),
      currRateSource: String(snapshotHeader?.currRateSource || ''),
      vocDate: String(snapshotHeader?.vocDate || ''),
      vocNo: String(snapshotHeader?.vocNo || ''),
      salesman: String(snapshotHeader?.salesman || ''),
      docDate: String(snapshotHeader?.docDate || ''),
      valueDate: String(snapshotHeader?.valueDate || ''),
      fixingType: String(snapshotHeader?.fixingType || ''),
    },
    selectedPartyId: String(snapshotPartyId || ''),
    lineItems: Array.isArray(snapshotLineItems)
      ? snapshotLineItems.map((line) => ({ ...line, type: normalizeLineType(line?.type) }))
      : [],
  }), [])

  const hasDraftLineFormData = useCallback(() => {
    if (!showLineForm) return false
    return Boolean(
      String(lineForm.acCode || '').trim()
      || String(lineForm.stockCode || '').trim()
      || String(lineForm.productType || '').trim()
      || Number(lineForm.amountLC || 0)
      || Number(lineForm.amountFC || 0)
      || Number(lineForm.totalAmount || 0)
      || Number(lineForm.metalAmount || 0)
      || Number(lineForm.grossWeight || 0)
      || Number(lineForm.pureWeight || 0)
      || Number(lineForm.premiumAmount || 0)
      || Number(lineForm.makingCharges || 0)
    )
  }, [showLineForm, lineForm])

  const hasUnsavedVoucherChanges = useCallback(() => {
    if (mode !== 'create') return false
    if (hasDraftLineFormData()) return true
    return buildFormSnapshot(header, lineItems, selectedPartyId) !== initialFormSnapshotRef.current
  }, [mode, hasDraftLineFormData, buildFormSnapshot, header, lineItems, selectedPartyId])

  const confirmExitVoucherForm = useCallback(() => {
    if (!hasUnsavedVoucherChanges()) return true
    return window.confirm('Close voucher form and discard unsaved changes?')
  }, [hasUnsavedVoucherChanges])

  const {
    inventoryProducts,
    loadingInventoryProducts,
    applyLineAutoCalc,
    applyProductTypeAutoFill,
    handleStockSelection,
  } = useVoucherLineAutoCalc({
    token,
    canView,
    voucherType,
    voucherErpApi,
    latestMetalRates,
    showLineForm,
    setLineForm,
    lineFormGrossWeight: lineForm.grossWeight,
    lineFormPurity: lineForm.purity,
    lineFormMetalRate: lineForm.metalRate,
    lineFormRateType: lineForm.rateType,
    lineFormVatPer: lineForm.vatPer,
    lineFormPremiumValue: lineForm.premiumValue,
    lineFormMakingCharges: lineForm.makingCharges,
  })

  // ─── helpers ─────────────────────────────────────────────────────────────────
  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  const clearError = useCallback(() => setError(''), [])
  const runToolbarAction = useCallback((label, action) => {
    clearError()
    try {
      const result = action?.()
      if (result && typeof result.then === 'function') {
        result.catch((err) => {
          console.error(`[VoucherToolbar] ${label} failed`, err)
          setError(err?.message || `${label} failed. Please try again.`)
        })
      }
    } catch (err) {
      console.error(`[VoucherToolbar] ${label} failed`, err)
      setError(err?.message || `${label} failed. Please try again.`)
    }
  }, [clearError])

  const effectiveLineItems = (() => {
    if (!showLineForm) return lineItems

    const draftLine = {
      ...lineForm,
      type: normalizeLineType(lineForm.type),
      amountLC: lineForm.amountLC || lineForm.totalAmount || lineForm.metalAmount || '',
      amountWithVAT: lineForm.amountWithVAT || lineForm.amountLC || lineForm.amountFC || '',
    }

    if (editingLineIdx !== null) {
      return lineItems.map((item, index) => (index === editingLineIdx ? draftLine : item))
    }

    const hasDraftContent = Boolean(
      String(draftLine.stockCode || draftLine.acCode || draftLine.productType || '').trim()
      || (isMetalTransferVoucherType(voucherType) && hasMetalTransferLineQuantity(draftLine))
      || parseFloat(draftLine.amountWithVAT)
      || parseFloat(draftLine.amountLC)
      || parseFloat(draftLine.metalAmount)
    )

    return hasDraftContent ? [...lineItems, draftLine] : lineItems
  })()

  // Receipt/payment: `amountLC` / amountWithVAT are USD-equivalent (FC / display rate). `transaction.amount`
  // must be FC in document currency so the backend applies `exchangeRate` once. Net total shows FC received/paid.
  const isReceiptOrPaymentVoucher = ['receipt', 'payment'].includes(String(voucherType || '').toLowerCase())
  const receiptPaymentFcSum = isReceiptOrPaymentVoucher
    ? effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountFC) || 0), 0)
    : 0
  const receiptPaymentNetAmtLabelCurrency = (() => {
    if (!isReceiptOrPaymentVoucher || receiptPaymentFcSum <= 0) return ''
    const line = effectiveLineItems.find((l) => (parseFloat(l.amountFC) || 0) > 0)
    const code = String(line?.currCode || '').trim().toUpperCase()
    return code || 'FC'
  })()
  const receiptPaymentLegacyGrand = effectiveLineItems.reduce(
    (s, l) => s + (parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0),
    0,
  )

  const totals = {
    grossWeightTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.grossWeight) || 0), 0),
    pureWeightTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.pureWeight) || 0), 0),
    pcsTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.pcs) || 0), 0),
    metalTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.metalAmount) || 0), 0),
    premiumTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.premiumAmount) || 0), 0),
    makingTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.makingCharges) || 0), 0),
    total: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountLC) || 0), 0),
    vatAmount: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.vatAmountLC) || 0), 0),
    grandTotal:
      isReceiptOrPaymentVoucher && receiptPaymentFcSum > 0
        ? receiptPaymentFcSum
        : receiptPaymentLegacyGrand,
  }

  const printModel = useVoucherPrintModel({
    voucherType,
    header,
    effectiveLineItems,
    totals,
    accounts,
    user,
    reportBranding,
    voucherLabel: (voucherConfigs[voucherType] || voucherConfigs.payment).label,
    isMetalVoucher: isMetalStockVoucherType(voucherType),
    isSimpleMetalVoucher: isMetalTransferVoucherType(voucherType),
    findPartyOptionByCode,
    resolveVoucherParty,
    lineItems,
  })

  const handlePrintPreview = useCallback(() => {
    if (voucherPreviewEnabled) {
      setShowVoucherPreview(true)
      return
    }
    window.print()
  }, [voucherPreviewEnabled])

  const canCreate = voucherType === 'payment'
    ? canCreatePayment
    : voucherType === 'receipt'
      ? canCreateReceipt
      : voucherType === 'purchase'
        ? canCreatePurchase
        : voucherType === 'metal_receipt'
          ? canCreateMetalReceipt
          : voucherType === 'metal_payment'
            ? canCreateMetalPayment
            : canCreateSale

  const sortVouchers = useCallback((items, type) => sortVouchersByDocNo(items, type), [])

  const resolveDisplayVoucherDocNo = useCallback(
    (voucher, typeOverride = voucherType) => displayVoucherDocNo(voucher, typeOverride || voucherType, header.docDate),
    [voucherType, header.docDate],
  )

  // ─── load vouchers ───────────────────────────────────────────────────────────
  const loadVouchers = useCallback(async () => {
    if (!canView) return
    setLoadingList(true)
    try {
      const year = normalizeFilterYear(voucherFilterYear)
      const months = normalizeFilterMonths(voucherFilterMonths)
      const res = await voucherErpApi.getTransactions(token, {
        type: voucherType,
        limit: 200,
        ...(year ? { year } : {}),
        ...(months.length ? { months: toMonthCsv(months) } : {}),
      })
      const txs = sortVouchers(
        (res.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(txs)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vouchers')
    } finally {
      setLoadingList(false)
    }
  }, [voucherType, canView, sortVouchers, token, voucherErpApi, voucherFilterYear, voucherFilterMonths])

  useEffect(() => { loadVouchers() }, [loadVouchers])

  useEffect(() => {
    if (enabledVoucherTypes.includes(voucherType)) return
    const nextType = enabledVoucherTypes[0] || 'payment'
    setVoucherType(nextType)
    setMode('list')
  }, [enabledVoucherTypes, voucherType])

  useEffect(() => {
    if (!modalDrag) return

    const onMouseMove = (e) => {
      const dx = e.clientX - modalDrag.startX
      const dy = e.clientY - modalDrag.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragMetaRef.current.moved = true
      }
      setModalOffset({
        x: modalDrag.baseX + dx,
        y: modalDrag.baseY + dy,
      })
    }

    const onMouseUp = () => {
      setModalDrag(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [modalDrag])

  const resolveNextVocNo = (list, voucherTypeOverride = voucherType, docDateOverride = header.docDate) => (
    nextVocNo(list, voucherTypeOverride, docDateOverride, vouchers)
  )

  const fetchServerNextVocNo = async (voucherTypeOverride = voucherType, docDateOverride = header.docDate) => {
    try {
      const res = await voucherErpApi.getNextVocNo(token, {
        type: voucherTypeOverride,
        docDate: docDateOverride || undefined,
      })
      if (res?.docNo) return String(res.docNo)
    } catch {
      // Fall back to local max+1 if the allocator is unreachable.
    }
    return ''
  }

  const handleModalHeaderMouseDown = (e) => {
    if ((mode !== 'create' && mode !== 'view') || e.button !== 0) return
    if (e.target instanceof Element && e.target.closest('button')) return

    dragMetaRef.current.moved = false
    setModalDrag({
      startX: e.clientX,
      startY: e.clientY,
      baseX: modalOffset.x,
      baseY: modalOffset.y,
    })
  }

  const handleVoucherModalBackdropClick = () => {
    if (mode !== 'create' && mode !== 'view') return
    if (dragMetaRef.current.moved) {
      dragMetaRef.current.moved = false
      return
    }
    if (!confirmExitVoucherForm()) {
      return
    }
    setMode('list')
  }

  const currentVoucher = editingId ? vouchers.find(v => v._id === editingId) : null
  const currentVoucherStatus = currentVoucher?.status || 'draft'

  const {
    openVoucher,
    openCreate,
    switchVoucherTab,
  } = useVoucherOpenEdit({
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
  })

  openVoucherRef.current = openVoucher

  const {
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
  } = useVoucherToolbarNav({
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
  })


  useVoucherPendingOpen({
    pendingOpenTransactionId,
    pendingOpenTransactionType,
    onPendingOpenTransactionConsumed,
    canView,
    token,
    enabledVoucherTypes,
    sortVouchers,
    setError,
    setVoucherType,
    setVouchers,
    openVoucherRef,
  })

  const handleWorkflowAction = async (action) => {
    if (!editingId) return
    if ((action === 'return' || action === 'reject') && !workflowNote.trim()) {
      setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
      return
    }

    setSaving(true)
    clearError()
    try {
      const requestAction = async (confirmVendorAdvance = false) => runVoucherWorkflowAction(
        token,
        editingId,
        action,
        { comment: workflowNote, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
      )

      try {
        await requestAction(false)
      } catch (e) {
        const needsAdvanceConfirmation = action === 'post'
          && e?.response?.status === 409
          && e?.response?.data?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'

        if (!needsAdvanceConfirmation) throw e
        if (!window.confirm(e.response?.data?.message || 'This payment will create a vendor advance. Continue?')) return
        await requestAction(true)
      }
      await loadVouchers()
      setWorkflowNote('')
      const actionLabel = action === 'submit'
        ? 'submitted'
        : action === 'approve'
          ? 'approved'
          : action === 'return'
            ? 'returned for edit'
            : action === 'reject'
              ? 'rejected'
              : 'posted'
      showMsg(`Voucher ${actionLabel} successfully`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} voucher`)
    } finally {
      setSaving(false)
    }
  }

  const handleListWorkflowAction = async (voucher, action) => {
    if (!voucher?._id) return
    let comment = ''

    if (action === 'return' || action === 'reject') {
      const promptLabel = action === 'return' ? 'Return reason' : 'Rejection reason'
      const value = window.prompt(`${promptLabel} (required):`, '')
      if (value === null) return
      if (!String(value).trim()) {
        setError(`${promptLabel} is required`)
        return
      }
      comment = String(value).trim()
    }

    setSaving(true)
    clearError()
    try {
      const requestAction = async (confirmVendorAdvance = false) => runVoucherWorkflowAction(
        token,
        voucher._id,
        action,
        { comment, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
      )

      try {
        await requestAction(false)
      } catch (e) {
        const needsAdvanceConfirmation = action === 'post'
          && e?.response?.status === 409
          && e?.response?.data?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'

        if (!needsAdvanceConfirmation) throw e
        if (!window.confirm(e.response?.data?.message || 'This payment will create a vendor advance. Continue?')) return
        await requestAction(true)
      }
      await loadVouchers()
      const actionLabel = action === 'submit'
        ? 'submitted'
        : action === 'approve'
          ? 'approved'
          : action === 'return'
            ? 'returned for edit'
            : action === 'reject'
              ? 'rejected'
              : 'posted'
      showMsg(`Voucher #${voucher.voucherMeta?.vocNo || '-'} ${actionLabel}`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} voucher`)
    } finally {
      setSaving(false)
    }
  }

  const handleVoidVoucher = async (voucher) => {
    if (!voucher?._id) return
    if (!window.confirm(`Void Receipt/Payment #${voucher.voucherMeta?.vocNo || '-'}? This will soft-delete linked ledger entries and keep an audit trail.`)) return
    const reason = window.prompt('Reason/comment for voiding this voucher (min 8 characters):', '')
    if (!reason || reason.trim().length < 8) {
      setError('Void reason/comment must be at least 8 characters.')
      return
    }
    const confirmToken = window.prompt('Destructive action confirmation token:', '')
    if (!confirmToken) {
      setError('Confirmation token is required to void a voucher.')
      return
    }
    setSaving(true)
    clearError()
    try {
      await voucherErpApi.voidTransaction(token, voucher._id, { reason: reason.trim(), confirmToken: confirmToken.trim() })
      await loadVouchers()
      showMsg(`Voucher #${voucher.voucherMeta?.vocNo || '-'} voided with audit trail`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to void voucher')
    } finally {
      setSaving(false)
    }
  }

  const formatFxRevalueSummary = (result, applied = false) => {
    const tx = result?.transaction || {}
    const counts = result?.counts || {}
    const candidate = (result?.journals || []).find((row) => row.status === 'update' || row.status === 'updated')
    const prefix = applied ? 'Revalued' : 'Preview'

    if (!counts.updateCandidates && !counts.updatedCount) {
      return `${prefix}: voucher #${tx.vocNo || '-'} already matches reference-rate FX valuation.`
    }

    const rowSummary = candidate ? ` ${fmt(candidate.currentAmount)} -> ${fmt(candidate.correctedAmount)}` : ''
    return `${prefix}: voucher #${tx.vocNo || '-'} ${counts.updatedCount || counts.updateCandidates || 0} FX journal row(s), reference rate ${Number(tx.referenceRate || 0).toFixed(6)}.${rowSummary}`
  }

  const handleRevalueFxJournal = async (voucher) => {
    if (!voucher?._id) return

    setSaving(true)
    clearError()
    try {
      const previewRes = await voucherErpApi.revalueFxJournal(token, voucher._id, { apply: false })
      const preview = previewRes || {}
      const tx = preview.transaction || {}
      const counts = preview.counts || {}
      const candidate = (preview.journals || []).find((row) => row.status === 'update')
      const confirmMessage = counts.updateCandidates
        ? [
            `Voucher #${tx.vocNo || '-'} FX preview`,
            `Direction: ${tx.expectedDirection || '-'}`,
            `Reference rate: ${Number(tx.referenceRate || 0).toFixed(6)}`,
            `Line rate: ${Number(tx.lineRate || 0).toFixed(6)}`,
            candidate ? `Journal amount: ${fmt(candidate.currentAmount)} -> ${fmt(candidate.correctedAmount)}` : '',
            'Apply revaluation now?',
          ].filter(Boolean).join('\n')
        : formatFxRevalueSummary(preview, false)

      if (!counts.updateCandidates) {
        showMsg(formatFxRevalueSummary(preview, false))
        return
      }

      if (!window.confirm(confirmMessage)) {
        showMsg(formatFxRevalueSummary(preview, false))
        return
      }

      const applyRes = await voucherErpApi.revalueFxJournal(token, voucher._id, { apply: true })
      showMsg(formatFxRevalueSummary(applyRes, true))
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to revalue FX journal')
    } finally {
      setSaving(false)
    }
  }

  const { saveVoucher } = useVoucherSave({
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
  })

  const {
    openAddLine,
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
  } = useVoucherLineForm({
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
  })

  // Lookup party name from the relevant customer/vendor master record.
  const lookupParty = (code) => {
    const resolvedParty = resolveVoucherParty(code)
    const selectedAccount = findPartyOptionByCode(code)
    setSelectedPartyId(selectedAccount?.id || resolvedParty?.partyId || '')
    setHdr('partyName', resolvedParty?.partyName || selectedAccount?.partyName || '')
    applyPartyCurrency(resolvedParty)
  }

  const searchPartyByCode = () => {
    const lookupCode = String(header.partyCode || '').trim()
    if (!lookupCode) {
      setSelectedPartyId('')
      setHdr('partyName', '')
      return
    }
    lookupParty(lookupCode)
  }

  const handlePartyCodeEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    searchPartyByCode()
  }

  const handlePartySelect = (partyId) => {
    setSelectedPartyId(partyId || '')
    if (!partyId) {
      setHdr('partyCode', '')
      setHdr('partyName', '')
      return
    }
    if (String(partyId).startsWith('customer:')) {
      const id = String(partyId).slice('customer:'.length)
      const c = activeCustomers.find((item) => String(item._id) === id)
      if (!c) {
        setHdr('partyCode', '')
        setHdr('partyName', '')
        return
      }
      const code = String(c.ledgerAccountId?.accountCode || '').trim() || String(c._id)
      setHdr('partyCode', code)
      setHdr('partyName', String(c.name || '').trim())
      applyPartyCurrency(resolveVoucherParty(code))
      return
    }
    if (String(partyId).startsWith('vendor:')) {
      const id = String(partyId).slice('vendor:'.length)
      const v = activeVendors.find((item) => String(item._id) === id)
      if (!v) {
        setHdr('partyCode', '')
        setHdr('partyName', '')
        return
      }
      const code = String(v.vendorCode || v.ledgerAccountId?.accountCode || '').trim() || String(v._id)
      setHdr('partyCode', code)
      setHdr('partyName', String(v.name || '').trim())
      applyPartyCurrency(resolveVoucherParty(code))
      return
    }
    const selected = partyOptions.find((item) => item.id === partyId)
    if (!selected) {
      setHdr('partyCode', '')
      setHdr('partyName', '')
      return
    }
    setHdr('partyCode', selected.partyCode)
    setHdr('partyName', selected.partyName)
    applyPartyCurrency(resolveVoucherParty(selected.partyCode))
  }

  useEffect(() => {
    if (menuTab !== 'accounts') return
    const resolvedParty = resolveVoucherParty(header.partyCode)
    if (!resolvedParty) {
      setRecentPartyVouchers([])
      return
    }
    loadRecentPartyVouchers(resolvedParty)
  }, [menuTab, header.partyCode, resolveVoucherParty, loadRecentPartyVouchers])

  // ─── filtered list ───────────────────────────────────────────────────────────
  const filteredVouchers = useMemo(() => vouchers.filter((voucher) => {
    if (selectedStatus && voucher.status !== selectedStatus) return false
    const meta = voucher.voucherMeta || {}
    const searchMatched = includesSearchTerm([
      displayVoucherDocNo(voucher, voucherType),
      meta.vocNo,
      meta.partyCode,
      meta.partyName,
      meta.narration,
      voucher.description,
      ...(Array.isArray(meta.lineItems)
        ? meta.lineItems.flatMap((line) => [line?.narration, line?.exp, line?.acCode, line?.stockCode])
        : []),
    ], voucherSearch)
    if (!searchMatched) return false
    const dateValue = meta.docDate || meta.valueDate || voucher.date
    return matchesYearMonths(dateValue, voucherFilterYear, voucherFilterMonths)
  }), [
    vouchers,
    selectedStatus,
    voucherType,
    voucherSearch,
    voucherFilterYear,
    voucherFilterMonths,
  ])
  const canDeleteCurrentVoucher = Boolean(editingId) && !isReadOnly && currentVoucherStatus !== 'posted'
  const canSubmitWorkflow = Boolean(editingId) && !isReadOnly && ['draft', 'returned', 'rejected'].includes(currentVoucherStatus)
  const canApproveWorkflow = Boolean(editingId) && canManageWorkflow && currentVoucherStatus === 'submitted'
  const canReturnWorkflow = Boolean(editingId) && canManageWorkflow && ['submitted', 'approved'].includes(currentVoucherStatus)
  const canRejectWorkflow = Boolean(editingId) && canManageWorkflow && ['submitted', 'approved', 'returned'].includes(currentVoucherStatus)
  const canPostWorkflow = Boolean(editingId) && canManageWorkflow && currentVoucherStatus === 'approved'
  const canRevalueCurrentVoucher = Boolean(editingId) && isSuperAdmin && ['payment', 'receipt'].includes(voucherType) && currentVoucherStatus === 'posted'
  const currentAttachments = Array.isArray(currentVoucher?.attachments) ? currentVoucher.attachments : []
  const previewableAttachmentMimeTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ])
  const attachmentUrl = (attachment, download = false) => {
    const params = new URLSearchParams({ txId: editingId || '' })
    if (download) {
      params.set('download', '1')
    } else if (previewableAttachmentMimeTypes.has(String(attachment?.mimeType || '').trim().toLowerCase())) {
      params.set('preview', '1')
    }
    return `${BASE}/attachments/download/transaction/${encodeURIComponent(attachment.fileName)}?${params.toString()}`
  }

  const handleUploadVoucherAttachments = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean)
    if (!editingId) {
      setError('Save the voucher first, then add attachments.')
      return
    }
    if (!files.length) return

    setSaving(true)
    setError('')
    try {
      for (const file of files) {
        await voucherErpApi.uploadTransactionAttachment(token, editingId, file)
      }
      setAttachmentInputKey((prev) => prev + 1)
      await loadVouchers()
      const refreshed = await voucherErpApi.getTransactions(token, { type: voucherType, limit: 200 })
      const nextVouchers = sortVouchers(
        (refreshed.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(nextVouchers)
      const updated = nextVouchers.find((item) => item._id === editingId)
      if (updated) openVoucher(updated)
      showMsg(files.length === 1 ? 'Attachment uploaded' : `${files.length} attachments uploaded`)
      setMenuTab('attachments')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload attachment')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVoucherAttachment = async (attachmentId) => {
    if (!editingId || !attachmentId) return
    setSaving(true)
    setError('')
    try {
      await voucherErpApi.deleteTransactionAttachment(token, editingId, attachmentId)
      const refreshed = await voucherErpApi.getTransactions(token, { type: voucherType, limit: 200 })
      const nextVouchers = sortVouchers(
        (refreshed.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(nextVouchers)
      const updated = nextVouchers.find((item) => item._id === editingId)
      if (updated) openVoucher(updated)
      showMsg('Attachment deleted')
      setMenuTab('attachments')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete attachment')
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewVoucherAttachment = (attachment, download = false) => {
    if (!attachment?.fileName || !editingId) return
    window.open(attachmentUrl(attachment, download), '_blank', 'noopener,noreferrer')
  }

  // ─── guard ───────────────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', borderRadius: '0.5rem', color: S.danger, textAlign: 'center' }}>
        You do not have permission to access the Vouchers module.
      </div>
    )
  }

  const voucherConfig = voucherConfigs[voucherType] || voucherConfigs.payment
  const voucherLabel = voucherConfig.label
  const voucherCode = voucherConfig.code
  const voucherLabelT = voucherConfig.short
  const lineTableHeaders = isMetalVoucher
    ? (isSimpleMetalVoucher
      ? ['No.', 'Stock Code', 'Product Type', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.', '']
      : ['No.', 'Stock Code', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.', 'Rate Type', 'Metal Rate', 'Metal Amount', 'Total', ''])
    : ['No.', 'A/C Code', 'Type', 'Curr', 'Amount FC', 'Amount LC', '']
  const inventoryStockOptions = inventoryProducts
    .filter((item) => String(item.sku || '').trim())
    // Keep mapped inventory records only, so legacy records do not show duplicate-like stock choices.
    .filter((item) => String(item.category || '').includes('mainStock='))
    .map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const mainStock = toTitle(meta.mainStock || meta.metalType || 'Metal')
      return {
        code: String(item.sku || '').trim().toUpperCase(),
        metal: String(meta.mainStock || meta.metalType || 'zzzz').toLowerCase(),
        label: mainStock,
      }
    })
    .sort((a, b) => {
      const byMetal = a.metal.localeCompare(b.metal)
      if (byMetal !== 0) return byMetal
      return a.code.localeCompare(b.code)
    })

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
    <style>{VOUCHER_PRINT_MEDIA_CSS}</style>
    <div className="voucher-screen-only" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Notifications */}
      {error && (
        <div style={{ background: '#FEE2E2', color: S.danger, padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: S.danger, cursor: 'pointer', fontWeight: '700', fontSize: '1rem' }}>×</button>
        </div>
      )}
      {success && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      {/* ── Voucher type switcher ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {enabledVoucherTypes.map((type) => {
          const tabLabels = {
            payment: { icon: '💳', label: t('paymentVoucher') },
            receipt: { icon: '🧾', label: t('receiptVoucher') },
            purchase: { icon: '🟫', label: 'Metal Purchase' },
            sale: { icon: '🟨', label: 'Metal Sale' },
            metal_receipt: { icon: '📥', label: 'Metal Receipt' },
            metal_payment: { icon: '📤', label: 'Metal Payment' },
          }
          const tab = tabLabels[type] || { icon: '', label: type }
          return (
            <button
              key={type}
              style={tabBtn(voucherType === type)}
              onClick={() => switchVoucherTab(type)}
            >
              {tab.icon ? `${tab.icon} ` : ''}{tab.label}
            </button>
          )
        })}
        {mode !== 'list' && (
          <button style={btn('secondary')} onClick={() => setMode('list')}>
            ← Back to List
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ LIST MODE */}
      {mode === 'list' && (
        <VoucherListPanel
          voucherLabel={voucherLabel}
          voucherType={voucherType}
          isSimpleMetalVoucher={isSimpleMetalVoucher}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          voucherSearch={voucherSearch}
          onVoucherSearchChange={setVoucherSearch}
          voucherFilterYear={voucherFilterYear}
          onVoucherFilterYearChange={(value) => setVoucherFilterYear(normalizeFilterYear(value))}
          voucherFilterMonths={voucherFilterMonths}
          onVoucherFilterMonthsChange={(value) => setVoucherFilterMonths(normalizeFilterMonths(value))}
          t={t}
          loadVouchers={loadVouchers}
          canCreate={canCreate}
          loadingList={loadingList}
          filteredVouchers={filteredVouchers}
          openCreate={openCreate}
          openVoucher={openVoucher}
          isReadOnly={isReadOnly}
          saving={saving}
          handleListWorkflowAction={handleListWorkflowAction}
          canManageWorkflow={canManageWorkflow}
          isSuperAdmin={isSuperAdmin}
          isFinance={isFinance}
          handleVoidVoucher={handleVoidVoucher}
          handleRevalueFxJournal={handleRevalueFxJournal}
          displayVoucherDocNo={resolveDisplayVoucherDocNo}
          erpAdvancedListFiltersEnabled={erpAdvancedListFiltersEnabled}
        />
      )}

      <VoucherEditorPanel
        applyLineAutoCalc={applyLineAutoCalc}
        applyProductTypeAutoFill={applyProductTypeAutoFill}
        attachmentInputKey={attachmentInputKey}
        baseCurrencyCode={baseCurrencyCode}
        canApproveWorkflow={canApproveWorkflow}
        canCreate={canCreate}
        canDeleteCurrentVoucher={canDeleteCurrentVoucher}
        canPostWorkflow={canPostWorkflow}
        canRejectWorkflow={canRejectWorkflow}
        canReturnWorkflow={canReturnWorkflow}
        canRevalueCurrentVoucher={canRevalueCurrentVoucher}
        canSubmitWorkflow={canSubmitWorkflow}
        cancelLine={cancelLine}
        currencyOptions={currencyOptions}
        currentAttachments={currentAttachments}
        currentVoucher={currentVoucher}
        currentVoucherStatus={currentVoucherStatus}
        editingId={editingId}
        editingLineIdx={editingLineIdx}
        formReadOnly={formReadOnly}
        handleAddLineClick={handleAddLineClick}
        handleAmountFC={handleAmountFC}
        handleAmountLC={handleAmountLC}
        handleBarcodeAction={handleBarcodeAction}
        handleCancelChanges={handleCancelChanges}
        handleCurrRateChange={handleCurrRateChange}
        handleDeleteLineClick={handleDeleteLineClick}
        handleDeleteVoucher={handleDeleteVoucher}
        handleDeleteVoucherAttachment={handleDeleteVoucherAttachment}
        handleEditLineClick={handleEditLineClick}
        handleEditUnlock={handleEditUnlock}
        handleExitVoucherForm={handleExitVoucherForm}
        handleHeaderCurrRateChange={handleHeaderCurrRateChange}
        handleHeaderCurrencyChange={handleHeaderCurrencyChange}
        handleLineAcCodeChange={handleLineAcCodeChange}
        handleLineAmountEnter={handleLineAmountEnter}
        handleLineCurrencyChange={handleLineCurrencyChange}
        handleLineTypeChange={handleLineTypeChange}
        handleModalHeaderMouseDown={handleModalHeaderMouseDown}
        handlePartyCodeEnter={handlePartyCodeEnter}
        handlePartySelect={handlePartySelect}
        handlePreviewVoucherAttachment={handlePreviewVoucherAttachment}
        handleRevalueFxJournal={handleRevalueFxJournal}
        handleSearchFind={handleSearchFind}
        handleStockSelection={handleStockSelection}
        handleUploadVoucherAttachments={handleUploadVoucherAttachments}
        handleVoucherModalBackdropClick={handleVoucherModalBackdropClick}
        handleWorkflowAction={handleWorkflowAction}
        header={header}
        inventoryProducts={inventoryProducts}
        inventoryStockOptions={inventoryStockOptions}
        isMetalVoucher={isMetalVoucher}
        isReadOnly={isReadOnly}
        isSimpleMetalVoucher={isSimpleMetalVoucher}
        lineAccountComboGroups={lineAccountComboGroups}
        lineForm={lineForm}
        lineItems={lineItems}
        lineTableHeaders={lineTableHeaders}
        loadingInventoryProducts={loadingInventoryProducts}
        loadingRecentPartyVouchers={loadingRecentPartyVouchers}
        menuTab={menuTab}
        metalPartyComboGroups={metalPartyComboGroups}
        modalDrag={modalDrag}
        modalOffset={modalOffset}
        mode={mode}
        navFirst={navFirst}
        navLast={navLast}
        navNext={navNext}
        navPrev={navPrev}
        openAddLine={openAddLine}
        openCreate={openCreate}
        partyComboGroups={partyComboGroups}
        receiptPaymentNetAmtLabelCurrency={receiptPaymentNetAmtLabelCurrency}
        recentPartyVouchers={recentPartyVouchers}
        refreshParties={refreshParties}
        resolveVoucherParty={resolveVoucherParty}
        runToolbarAction={runToolbarAction}
        saveLine={saveLine}
        saveVoucher={saveVoucher}
        saving={saving}
        searchPartyByCode={searchPartyByCode}
        selectedPartyId={selectedPartyId}
        setHdr={setHdr}
        setLF={setLF}
        setLineForm={setLineForm}
        setMenuTab={setMenuTab}
        setMode={setMode}
        setWorkflowNote={setWorkflowNote}
        showAccountDetailsTab={showAccountDetailsTab}
        showLineForm={showLineForm}
        t={t}
        totals={totals}
        voucherCode={voucherCode}
        voucherConfig={voucherConfig}
        voucherLabel={voucherLabel}
        voucherLabelT={voucherLabelT}
        voucherType={voucherType}
        vouchers={vouchers}
        workflowNote={workflowNote}
        onPrintPreview={handlePrintPreview}
      />
    </div>

    <VoucherPreviewModal
      open={showVoucherPreview}
      onClose={() => setShowVoucherPreview(false)}
      mode="live"
      title={printModel.printTitle || 'Voucher Preview'}
      printModel={printModel}
      onPrint={() => window.print()}
    />

    <VoucherPrintPanel printModel={printModel} />
    </>
  )
}

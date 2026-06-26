import { useState, useEffect, useCallback, useRef } from 'react'
import axios from '../../api/client'
import { useLanguage } from '../../context/LanguageContext'
import { ACCOUNT_TYPES } from '../../constants/accountTypes'
import { getTenantBranding, isVoucherTypeEnabled } from '../../config/tenantBranding'
import { startMetalRatesRealtime } from '../../utils/realtimeSocket'
import { buildMetalRatesFromApiPayload, marketPricesToRates, resolveLiveVoucherMetalRate } from '../../utils/liveMetalRates'
import { BASE, cfg, fmt, today, S, btn, tabBtn, emptyLine, normalizeMongoIdField, emptyHeader, coerceVoucherDocNo, normalizeLookupValue, normalizeLineType, FIXED_AED_RATE, backendRateToDisplayRate, displayRateToBackendRate, normalizeRateType, normalizeVoucherFixingType, formatPartyAddress, decodeInventoryCategoryMeta, normalizeMetalSymbol, normalizeStockGroup, toTitle, decodeFullMeta, getAccountCodeValue, pickDefaultAccountCodeByType, isMetalStockVoucherType, isMetalTransferVoucherType, hasMetalTransferLineQuantity, sortVouchersByDocNo, nextVocNo, displayVoucherDocNo } from './voucher/voucherTabShared'
import { buildVoucherTypeConfigs } from './voucher/voucherTypeConfigs'
import VoucherListPanel from './voucher/VoucherListPanel'
import { useVoucherPrintModel } from './voucher/useVoucherPrintModel'
import VoucherPrintPanel from './voucher/VoucherPrintPanel'
import VoucherEditorPanel from './voucher/VoucherEditorPanel'
import { useVoucherPendingOpen } from './voucher/useVoucherPendingOpen'
import {
  filterActiveAccounts,
  filterActiveCustomers,
  filterActiveVendors,
  filterPartyAccounts,
} from './erp/accountDropdownHelpers'
import { useVoucherTabAccess } from './voucher/useVoucherTabAccess'

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

  const refreshParties = useCallback(async () => {
    try {
      const [custRes, vendRes] = await Promise.all([
        axios.get(`${BASE}/customers`, { ...cfg(), params: { limit: 500 } }),
        axios.get(`${BASE}/vendors`, { ...cfg(), params: { limit: 500 } }),
      ])
      setLocalCustomers(custRes.data.customers || [])
      setLocalVendors(vendRes.data.vendors || [])
    } catch {
      // silently ignore — props fallback still available
    }
  }, [])

  const refreshCurrencies = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/currencies`, cfg())
      const items = Array.isArray(res.data?.currencies) ? res.data.currencies : []
      if (items.length > 0) {
        setLocalCurrencies(items)
      }
    } catch {
      // silently ignore — fallback to prop currencies or USD-only defaults
    }
  }, [])

  const refreshMetalRates = useCallback(async () => {
    try {
      const liveRes = await axios.get(`${BASE}/metal-rates/live`, cfg())
      const liveRates = liveRes.data?.rates
      const lg = Number(liveRates?.goldPrice) || 0
      const ls = Number(liveRates?.silverPrice) || 0
      const lp = Number(liveRates?.platinumPrice) || 0
      if (liveRes.data?.success && liveRes.data?.live && liveRates && lg > 0 && ls > 0 && lp > 0) {
        setLatestMetalRates(buildMetalRatesFromApiPayload(liveRates))
        return
      }

      try {
        const marketRes = await axios.get(`${BASE}/reports/market-prices`, {
          ...cfg(),
          params: { currency: 'USD', unit: 'toz', fresh: 1 },
        })
        const marketRates = marketPricesToRates(marketRes.data)
        const mg = Number(marketRates?.goldPrice) || 0
        const ms = Number(marketRates?.silverPrice) || 0
        const mp = Number(marketRates?.platinumPrice) || 0
        if (marketRates && mg > 0 && ms > 0 && mp > 0) {
          setLatestMetalRates(buildMetalRatesFromApiPayload(marketRates))
          return
        }
      } catch {
        // Some roles can read vouchers but not reports.
      }

      const savedRes = await axios.get(`${BASE}/metal-rates`, cfg())
      if (savedRes.data?.success && savedRes.data?.rates) {
        setLatestMetalRates(buildMetalRatesFromApiPayload(savedRes.data.rates))
      }
    } catch {
      // Keep last known rates when refresh fails.
    }
  }, [])

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
    const tenant = getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name)?.key || ''
    return startMetalRatesRealtime({
      token,
      tenant,
      onRatesUpdate: (payload) => {
        const rates = payload?.rates || payload?.data?.rates
        if (rates) setLatestMetalRates(buildMetalRatesFromApiPayload(rates))
      },
    })
  }, [canView, token, user?.company, user?.tenant?.key, user?.tenant?.name])
  const [vouchers, setVouchers] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('list')            // 'list' | 'create' | 'view'
  const formReadOnly = isReadOnly || mode === 'view'
  const [editingId, setEditingId] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('') // workflow filter
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

      const response = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params,
      })

      const items = (response.data.transactions || [])
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
  }, [voucherType])

  // ─── line items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState([])
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLineIdx, setEditingLineIdx] = useState(null)
  const [lineForm, setLineForm] = useState(emptyLine())
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [loadingInventoryProducts, setLoadingInventoryProducts] = useState(false)
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

  const applyLineAutoCalc = useCallback((line) => {
    const next = { ...line }
    const grossWeight = parseFloat(next.grossWeight) || 0
    const purityValue = parseFloat(next.purity)
    const purityRatio = !Number.isFinite(purityValue) || purityValue <= 0
      ? 0
      : (purityValue > 1.2 ? purityValue / 1000 : purityValue)

    const pureWeight = grossWeight > 0 && purityRatio > 0
      ? Number((grossWeight * purityRatio).toFixed(3))
      : 0

    const weightInOz = pureWeight > 0
      ? Number((pureWeight / 31.1034768).toFixed(3))
      : 0

    const rateType = normalizeRateType(next.rateType)
    const metalRate = parseFloat(next.metalRate) || 0
    const rateQty = rateType === 'GRAM'
      ? pureWeight
      : rateType === 'KG'
        ? pureWeight / 1000
        : weightInOz

    const computedMetalAmount = rateQty > 0 && metalRate > 0
      ? Number((rateQty * metalRate).toFixed(2))
      : 0
    const existingMetalAmount = parseFloat(next.metalAmount) || 0
    const effectiveMetalAmount = computedMetalAmount > 0 ? computedMetalAmount : existingMetalAmount

    const premiumRate = parseFloat(next.premiumValue) || 0
    const computedPremiumAmount = rateQty > 0 && premiumRate !== 0
      ? Number((rateQty * premiumRate).toFixed(2))
      : 0
    const makingChargesAmt = parseFloat(next.makingCharges) || 0

    const baseTotal = Number((effectiveMetalAmount + computedPremiumAmount + makingChargesAmt).toFixed(2))
    const vatPer = parseFloat(next.vatPer) || 0
    const vatAmount = Number(((baseTotal * vatPer) / 100).toFixed(2))
    const amountWithVAT = Number((baseTotal + vatAmount).toFixed(2))
    const derivedMetalRate = rateQty > 0 && effectiveMetalAmount > 0
      ? Number((effectiveMetalAmount / rateQty).toFixed(2))
      : 0
    const effectiveMetalRate = metalRate > 0 ? metalRate : derivedMetalRate

    return {
      ...next,
      pureWeight: pureWeight > 0 ? pureWeight.toFixed(3) : '',
      weightInOz: weightInOz > 0 ? weightInOz.toFixed(3) : '',
      metalRate: effectiveMetalRate > 0 ? effectiveMetalRate.toFixed(2) : (next.metalRate || ''),
      metalAmount: effectiveMetalAmount > 0 ? effectiveMetalAmount.toFixed(2) : '',
      premiumAmount: computedPremiumAmount !== 0 ? computedPremiumAmount.toFixed(2) : '',
      totalAmount: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      amountLC: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      vatAmountLC: vatPer > 0 ? vatAmount.toFixed(2) : '',
      vatAmountFC: vatPer > 0 ? vatAmount.toFixed(2) : '',
      amountWithVAT: baseTotal > 0 ? amountWithVAT.toFixed(2) : '',
    }
  }, [])

  const applyProductTypeAutoFill = useCallback((line, productNameOverride) => {
    const productName = String(productNameOverride ?? (line.productType || '')).trim()
    if (!productName) return line

    const product = inventoryProducts.find(
      (item) => item.name === productName && String(item.category || '').includes('recordType=product')
    )
    if (!product) {
      return { ...line, productType: productName, inventoryItemId: '' }
    }

    const meta = decodeFullMeta(product.category)
    const simMeta = decodeInventoryCategoryMeta(product.category)
    const unitWeight = parseFloat(meta.weight || product.weight || '') || 0
    const pcs = Math.max(0, parseFloat(line.pcs) || 0)
    const grossWeight = unitWeight > 0
      ? (pcs > 0 ? unitWeight * pcs : unitWeight)
      : (parseFloat(line.grossWeight) || 0)
    const rawPurity = parseFloat(meta.productPurity || simMeta.purity || '') || 0
    const productVatPer = parseFloat(meta.vatPercent || '') || 0
    const productTaxType = String(meta.taxType || 'VAT').trim()

    return applyLineAutoCalc({
      ...line,
      inventoryItemId: String(product._id),
      productType: productName,
      grossWeight: grossWeight > 0 ? String(Number(grossWeight.toFixed(3))) : line.grossWeight,
      purity: rawPurity > 0 ? String(rawPurity) : line.purity,
      vatType: isMetalTransferVoucherType(voucherType) ? 'None' : (productTaxType || line.vatType || 'VAT'),
      vatPer: isMetalTransferVoucherType(voucherType) ? '0' : (productVatPer > 0 ? String(productVatPer) : line.vatPer),
    })
  }, [applyLineAutoCalc, inventoryProducts, voucherType])

  const handleStockSelection = useCallback((selectedStockCode) => {
    const normalizedStockCode = String(selectedStockCode || '').trim()
    if (!normalizedStockCode) {
      setLineForm((prev) => ({ ...prev, stockCode: '', inventoryItemId: '' }))
      return
    }

    const product = inventoryProducts.find((item) => String(item.sku || '').trim().toLowerCase() === normalizedStockCode.toLowerCase())

    if (!product) {
      setLineForm((prev) => ({ ...prev, stockCode: normalizedStockCode, inventoryItemId: '' }))
      return
    }

    const fullMeta = decodeFullMeta(product.category)
    const meta = decodeInventoryCategoryMeta(product.category)
    const mainStock = meta.mainStock || meta.metalType || ''
    const symbol = normalizeMetalSymbol(mainStock, meta.metalType)
    const stockGroup = normalizeStockGroup(mainStock, meta.metalType)
    const storedPriceUnit = String(fullMeta.priceUnit || '').trim().toUpperCase()
    const resolvedRateType = normalizeRateType(storedPriceUnit || 'OZ')
    const storedCurrency = String(fullMeta.priceCurrency || product.currency || 'USD').toUpperCase()
    const productVatPer = parseFloat(fullMeta.vatPercent || '') || 0
    const productTaxType = String(fullMeta.taxType || 'VAT').trim()
    const liveRate = resolveLiveVoucherMetalRate(symbol, mainStock, latestMetalRates, resolvedRateType)
    const storedRate = (voucherType === 'sale' || voucherType === 'metal_payment')
      ? Number(product.sellingPrice || 0)
      : Number(product.unitCost || 0)
    const defaultRate = liveRate > 0 ? liveRate : storedRate

    setLineForm((prev) => applyLineAutoCalc({
      ...prev,
      inventoryItemId: String(product._id),
      stockCode: String(product.sku || normalizedStockCode),
      stockGroup,
      metalSymbol: symbol,
      metalName: toTitle(mainStock || meta.metalType || product.name || 'Metal'),
      location: String(product.wipStage || prev.location || ''),
      availStock: `${Number(product.quantity || 0).toLocaleString()} ${String(product.unit || '').trim()}`.trim(),
      purity: String(meta.purity || prev.purity || ''),
      metalRate: defaultRate > 0 ? defaultRate.toFixed(2) : prev.metalRate,
      rateType: resolvedRateType,
      currCode: storedCurrency,
      vatType: isMetalTransferVoucherType(voucherType) ? 'None' : (productTaxType || prev.vatType || 'VAT'),
      vatPer: isMetalTransferVoucherType(voucherType) ? '0' : (productVatPer > 0 ? String(productVatPer) : prev.vatPer),
    }))
  }, [applyLineAutoCalc, inventoryProducts, latestMetalRates, voucherType])

  useEffect(() => {
    if (!canView) return
    let mounted = true

    const loadInventoryProducts = async () => {
      setLoadingInventoryProducts(true)
      try {
        const res = await axios.get(`${BASE}/inventory/products`, {
          ...cfg(),
          params: { page: 1, limit: 500 },
        })
        if (!mounted) return
        setInventoryProducts(res.data.products || [])
      } catch {
        if (mounted) setInventoryProducts([])
      } finally {
        if (mounted) setLoadingInventoryProducts(false)
      }
    }

    loadInventoryProducts()
    return () => { mounted = false }
  }, [canView])

  useEffect(() => {
    if (!showLineForm || !isMetalStockVoucherType(voucherType)) return
    setLineForm((prev) => {
      const calculated = applyLineAutoCalc(prev)
      const keys = ['pureWeight', 'weightInOz', 'metalAmount', 'totalAmount', 'amountLC', 'vatAmountLC', 'vatAmountFC', 'amountWithVAT']
      const hasChanges = keys.some((key) => String(prev[key] || '') !== String(calculated[key] || ''))
      return hasChanges ? calculated : prev
    })
  }, [showLineForm, voucherType, lineForm.grossWeight, lineForm.purity, lineForm.metalRate, lineForm.rateType, lineForm.vatPer, lineForm.premiumValue, lineForm.makingCharges, applyLineAutoCalc])

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
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const txs = sortVouchers(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(txs)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vouchers')
    } finally {
      setLoadingList(false)
    }
  }, [voucherType, canView, sortVouchers])

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

  // ─── open create ────────────────────────────────────────────────────────────
  const openCreate = (freshList, forcedType = voucherType) => {
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
    const nextHeader = {
      ...baseHeader,
      vocNo: resolveNextVocNo(freshList, forcedType, baseHeader.docDate),
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

  // ─── open last voucher for a type, or blank form if none exist ───────────────
  const openLastOrCreate = async (type) => {
    try {
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type, limit: 200 },
      })
      const txs = sortVouchers(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
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

  // ─── ERP toolbar navigation & delete ─────────────────────────────────────────
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
      setHeader({ ...emptyHeader(), vocNo: resolveNextVocNo() })
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
      await axios.delete(`${BASE}/transactions/${deletedId}`, cfg())
      showMsg('Voucher deleted')
      await loadVouchers()
      // After reload, vouchers state is stale here — re-fetch locally to navigate
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const remaining = sortVouchers(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
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

  // ─── open view/edit ──────────────────────────────────────────────────────────
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
  openVoucherRef.current = openVoucher

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
      const requestAction = async (confirmVendorAdvance = false) => axios.post(
        `${BASE}/transactions/${editingId}/${action}`,
        { comment: workflowNote, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
        cfg()
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
      const requestAction = async (confirmVendorAdvance = false) => axios.post(
        `${BASE}/transactions/${voucher._id}/${action}`,
        { comment, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
        cfg()
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
      await axios.post(`${BASE}/transactions/${voucher._id}/void`, { reason: reason.trim(), confirmToken: confirmToken.trim() }, cfg())
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
      const previewRes = await axios.post(`${BASE}/transactions/${voucher._id}/revalue-fx-journal`, { apply: false }, cfg())
      const preview = previewRes.data || {}
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

      const applyRes = await axios.post(`${BASE}/transactions/${voucher._id}/revalue-fx-journal`, { apply: true }, cfg())
      showMsg(formatFxRevalueSummary(applyRes.data, true))
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to revalue FX journal')
    } finally {
      setSaving(false)
    }
  }

  // ─── save voucher ────────────────────────────────────────────────────────────
  const saveVoucher = async () => {
    clearError()

    if (formReadOnly) {
      setError('Click Edit to unlock the voucher before saving changes')
      return
    }

    let effectiveLineItems = [...lineItems]
    if (showLineForm) {
      const hasLineAmount = isSimpleMetalSave
        ? hasMetalTransferLineQuantity(lineForm)
        : Boolean(lineForm.amountLC || lineForm.amountFC || lineForm.totalAmount || lineForm.metalAmount)
      if ((!isMetalVoucher && !lineForm.acCode.trim()) || !hasLineAmount) {
        setError(isSimpleMetalSave
          ? 'Complete stock/weight details and click Save Line, or cancel the open line before saving voucher'
          : 'Complete line details and click Save Line, or cancel the open line before saving voucher')
        return
      }
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
      setLineItems(effectiveLineItems)
      setShowLineForm(false)
      setEditingLineIdx(null)
    }

    if (!header.partyCode.trim()) { setError('Party Code is required'); return }
    if (!effectiveLineItems.length) { setError('Add at least one line item'); return }
    const resolvedParty = resolveVoucherParty(header.partyCode)
    const selectedAccount = findPartyOptionByCode(header.partyCode)
    if (!resolvedParty && !selectedAccount) {
      setError('Party must match a customer, vendor, or chart account')
      return
    }

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
    const normalizedVoucherType = String(voucherType || '').toLowerCase()
    const resolvedDocNo = coerceVoucherDocNo(normalizedVoucherType, header.vocNo, header.docDate)
    const isSimpleMetalSave = isMetalTransferVoucherType(normalizedVoucherType)
    const normalizedHeaderCurrency = String(header.currCode || baseCurrencyCode || 'USD').trim().toUpperCase()
    const isReceiptPayment = ['receipt', 'payment'].includes(normalizedVoucherType)
    const backendHeaderRate = displayRateToBackendRate(header.currRate, normalizedHeaderCurrency, isReceiptPayment)
    const requiresReferenceRate = isReceiptPayment && normalizedHeaderCurrency !== String(baseCurrencyCode || 'USD').trim().toUpperCase()
    if (requiresReferenceRate && (!Number.isFinite(backendHeaderRate) || backendHeaderRate <= 0)) {
      setError(`Reference exchange rate is required for ${normalizedVoucherType} transactions in ${normalizedHeaderCurrency}`)
      return
    }

    const receiptPaymentDocTotal = isReceiptPayment
      ? effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountFC) || 0), 0)
      : 0
    const resolvedDocAmount = isSimpleMetalSave
      ? 0.01
      : isReceiptPayment && receiptPaymentDocTotal > 0
        ? receiptPaymentDocTotal
        : (totals.grandTotal || 0.01)

    const payload = {
      type: voucherType,
      amount: resolvedDocAmount,
      date: isSimpleMetalSave ? (header.docDate || header.valueDate || header.vocDate) : (header.valueDate || header.vocDate),
      description: `${voucherType} voucher ${resolvedDocNo || ''}`.trim(),
      currency: isReceiptPayment ? normalizedHeaderCurrency : baseCurrencyCode,
      exchangeRate: isReceiptPayment ? backendHeaderRate : 1,
      customerId: resolvedParty?.customerId || undefined,
      vendorId: resolvedParty?.vendorId || undefined,
      voucherMeta: {
        partyCode: header.partyCode,
        partyName: header.partyName || resolvedParty?.partyName || '',
        partyAccountId: selectedAccount?.accountId || partyLedgerIdFromResolved() || '',
        salesman: header.salesman,
        vocNo: resolvedDocNo,
        docDate: header.docDate || null,
        valueDate: isSimpleMetalSave ? (header.docDate || header.valueDate || null) : (header.valueDate || null),
        currRateSource: header.currRateSource || 'manual',
        rateMeta: {
          headerRateSource: header.currRateSource || 'manual',
          goldPrice: Number(latestMetalRates.goldPrice || 0),
          goldPriceCurrency: String(latestMetalRates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
          goldPriceUpdatedAt: latestMetalRates.updatedAt || null,
        },
        ...(requiresReferenceRate ? { referenceExchangeRate: backendHeaderRate } : {}),
        ...(isMetalStockVoucherType(voucherType) && !isSimpleMetalSave ? { fixingType: normalizeVoucherFixingType(header.fixingType) } : {}),
        lineItems: effectiveLineItems.map((l) => ({
          ...l,
          inventoryItemId: normalizeMongoIdField(l.inventoryItemId),
          currRateSource: l.currRateSource || 'manual',
          amountFC: parseFloat(l.amountFC) || 0,
          amountLC: parseFloat(l.amountLC) || 0,
          headerAmt: parseFloat(l.headerAmt) || 0,
          currRate: displayRateToBackendRate(l.currRate, l.currCode || header.currCode, isReceiptPayment),
          ...(l.referenceRate ? { referenceRate: displayRateToBackendRate(l.referenceRate, l.currCode || header.currCode, isReceiptPayment) } : {}),
          vatPer: parseFloat(l.vatPer) || 0,
          vatAmountFC: parseFloat(l.vatAmountFC) || 0,
          vatAmountLC: parseFloat(l.vatAmountLC) || 0,
          amountWithVAT: parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0,
          headerAmountWithVAT: parseFloat(l.headerAmountWithVAT) || 0,
        })),
      },
      ...(isMetalStockVoucherType(voucherType) && !isSimpleMetalSave
        ? { metalFixStatus: normalizeVoucherFixingType(header.fixingType) === 'non-fixing' ? 'unfixed' : 'fixed' }
        : {}),
    }
    const payloadLineTotal = isReceiptPayment && receiptPaymentDocTotal > 0
      ? receiptPaymentDocTotal
      : effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0), 0)
    payload.amount = isSimpleMetalSave ? 0.01 : (payloadLineTotal || 0.01)
    setSaving(true)
    try {
      let savedId = editingId
      if (editingId) {
        await axios.put(`${BASE}/transactions/${editingId}`, payload, cfg())
        showMsg('Voucher updated successfully')
      } else {
        const res = await axios.post(`${BASE}/transactions`, payload, cfg())
        savedId = res.data?.transaction?._id || null
        showMsg('Voucher saved successfully')
      }
      await loadVouchers()
      // After save, reload list then open the exact voucher that was saved
      const res2 = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const refreshed = sortVouchers(
        (res2.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
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

  // ─── line form actions ───────────────────────────────────────────────────────
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

  const deleteLine = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx))

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

  const cancelLine = () => { setShowLineForm(false); setEditingLineIdx(null); clearError() }

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
      setLineItems(prev => prev.map((l, i) => i === editingLineIdx ? line : l))
    } else {
      setLineItems(prev => [...prev, line])
    }
    setShowLineForm(false)
    setEditingLineIdx(null)
    clearError()
  }

  // When type changes to Cash, clear cheque fields
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

  // Payment/Receipt: simple FC ↔ LC conversion via exchange rate — no VAT/tax.
  // UI convention is "1 USD = FC" for non-USD currencies (e.g. UZS 12048.1928).
  //   → LC = FC / rate, and FC = LC * rate
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

  const handleLineAcCodeChange = (val) => {
    setLF('acCode', val)
    applySettlementAccountCurrency(val)
  }

  const recalcReceiptPaymentLine = (baseLine, source) => {
    const next = { ...baseLine }
    const parseEditableNumber = (value) => {
      const raw = String(value ?? '').trim()
      if (!raw || raw === '.' || raw === '-' || raw === '-.') return null
      const num = Number.parseFloat(raw)
      return Number.isFinite(num) ? num : null
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
      nextAmountLC = Number.isFinite(computedLC) ? computedLC.toFixed(2) : nextAmountLC
    } else if (source === 'amountLC' && parsedAmountLC !== null) {
      const computedFC = parsedAmountLC * rate
      nextAmountFC = Number.isFinite(computedFC) ? computedFC.toFixed(2) : nextAmountFC
    }

    const amountLCForTotal = parseEditableNumber(nextAmountLC)

    return {
      ...next,
      amountFC: nextAmountFC,
      amountLC: nextAmountLC,
      vatPer: '',
      vatAmountFC: '',
      vatAmountLC: '',
      amountWithVAT: amountLCForTotal !== null ? amountLCForTotal.toFixed(2) : '',
    }
  }

  const handleAmountFC = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, amountFC: val }, 'amountFC'))
  }

  const handleAmountLC = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, amountLC: val }, 'amountLC'))
  }

  const handleCurrRateChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, currRate: val, currRateSource: 'manual' }, 'rate'))
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

    // Keep payment/receipt line entry aligned with header currency unless user changes line currency again.
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
  }, [voucherType, currencyOptions, header.currCode, resolvePaymentRate])

  const handleLineCurrencyChange = (nextCode) => {
    const normalized = String(nextCode || 'USD').trim().toUpperCase()
    const resolved = resolvePaymentRate(normalized)
    if (isMetalVoucher) {
      setLF('currCode', normalized)
      return
    }
    setLineForm((prev) => recalcReceiptPaymentLine({ ...prev, currCode: normalized, currRate: resolved.rate.toFixed(6), currRateSource: resolved.source }, 'rate'))
  }

  const handleLineAmountEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!showLineForm) return
    saveLine()
  }

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
  const filteredVouchers = selectedStatus
    ? vouchers.filter(v => v.status === selectedStatus)
    : vouchers
  const currentVoucher = editingId ? vouchers.find(v => v._id === editingId) : null
  const currentVoucherStatus = currentVoucher?.status || 'draft'
  const canDeleteCurrentVoucher = Boolean(editingId) && !isReadOnly && currentVoucherStatus !== 'posted'
  const canSubmitWorkflow = Boolean(editingId) && !isReadOnly && ['draft', 'returned', 'rejected'].includes(currentVoucherStatus)
  const canApproveWorkflow = Boolean(editingId) && canManageWorkflow && currentVoucherStatus === 'submitted'
  const canReturnWorkflow = Boolean(editingId) && canManageWorkflow && ['submitted', 'approved'].includes(currentVoucherStatus)
  const canRejectWorkflow = Boolean(editingId) && canManageWorkflow && ['submitted', 'approved', 'returned'].includes(currentVoucherStatus)
  const canPostWorkflow = Boolean(editingId) && canManageWorkflow && ['submitted', 'approved'].includes(currentVoucherStatus)
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
        const formData = new FormData()
        formData.append('file', file)
        await axios.post(`${BASE}/transactions/${editingId}/attachments`, formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      setAttachmentInputKey((prev) => prev + 1)
      await loadVouchers()
      const refreshed = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const nextVouchers = sortVouchers(
        (refreshed.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
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
      await axios.delete(`${BASE}/transactions/${editingId}/attachments/${attachmentId}`, cfg())
      const refreshed = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const nextVouchers = sortVouchers(
        (refreshed.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
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
  const isMetalVoucher = isMetalStockVoucherType(voucherType)
  const isSimpleMetalVoucher = isMetalTransferVoucherType(voucherType)
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
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 5mm; }
        .voucher-screen-only { display: none !important; }
        .voucher-print-only { display: block !important; }
        body * { visibility: hidden; }
        .voucher-print-only, .voucher-print-only * { visibility: visible; }
        .voucher-print-only {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          color-adjust: exact;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .voucher-print-only img {
          filter: none !important;
          mix-blend-mode: normal !important;
          color-adjust: exact;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
      }
    `}</style>
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
      />
    </div>

    <VoucherPrintPanel printModel={printModel} />
    </>
  )
}

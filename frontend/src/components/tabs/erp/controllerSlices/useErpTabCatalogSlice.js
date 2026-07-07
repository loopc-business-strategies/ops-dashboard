import { useEffect, useMemo } from 'react'
import { buildEntryAccountOptions } from '../accountDropdownHelpers'
import { ENQUIRY_DETAILS_PANEL_STORAGE_KEY, ACCOUNT_TYPE_ORDER } from '../../erpTabConstants'
import { useFixingRegisterPanelDrag } from '../useFixingRegisterPanelDrag'
import { useFixingRegisterStockTypeOptions } from '../useFixingRegisterStockTypeOptions'
import { useAccountEnquiryStatement } from '../accountEnquiry/useAccountEnquiryStatement'
import { useAccountEnquiryModalDrag } from '../accountEnquiry/useAccountEnquiryModalDrag'

import { getAvailableTransactionTypes } from '../accessPolicy'
import { DEFAULT_INVENTORY_STOCK_CODE_SETTINGS, decodeInventoryCategoryMeta, decodeInventoryCategoryPairs, titleCaseWords } from '../erpTabUtils'
import { useErpCustomerMargin, useErpSupplierMargin, useErpMarginContextMenuDismissal } from '../useErpMarginTabs'

import { resolveInventoryValuationUnitCost } from '../../../../utils/liveMetalRates'
import { normalizeJvCurrencyCode } from '../journalVoucherHelpers'
import { resolveCurrencyRowByCode } from '../erpCurrencyRowHelpers'



export function useErpTabCatalogSlice(scope) {
  const {
    accountEnquiryCode,
    accountEnquiryData,
    accounts,
    activeTab,
    convertJvAmount,
    currencies,
    customers,
    detailsPanel,
    erpBaseCurrencyCode,
    erpGoldPriceUSD,
    erpLiveMetalSnapshot,
    erpSilverPriceUSD,
    inventoryProductForm,
    inventoryProducts,
    inventoryStockCodeSettings,
    inventoryStockCodeSettingsKey,
    inventoryVatFilter,
    inventoryVatSortDir,
    metalRates,
    safeSummaryAccounts,
    selectedTransactionId,
    setDetailsPanel,
    setInventoryStockCodeSettings,
    setJvHeader,
    setShowStatementAuditIds,
    setStatementAuditPreferenceReady,
    showEnquiryModal,
    showStatementAuditIds,
    statementAuditPreferenceKey,
    statementAuditPreferenceReady,
    statementFilters,
    statementMetalCommodityEnabled,
    transactionMeta,
    transactions,
    usdConversion,
    user,
    vendors,
    loadCurrencies,
  } = scope

  useEffect(() => {
    if (!showEnquiryModal || currencies.length) return
    loadCurrencies?.()
  }, [showEnquiryModal, currencies.length, loadCurrencies])

  const selectedUsdConversionCurrency = resolveCurrencyRowByCode(currencies, usdConversion.targetCode, erpBaseCurrencyCode)
  const selectedUsdConversionRate = Number(selectedUsdConversionCurrency?.exchangeRate || 0)
  const usdAmountValue = Number(usdConversion.usdAmount || 0)
  const usdMasterRow = resolveCurrencyRowByCode(currencies, 'USD', erpBaseCurrencyCode)
  const basePerUsd = Number(usdMasterRow?.exchangeRate || 0)
  const usdToTargetAmount = (() => {
    if (!Number.isFinite(usdAmountValue) || usdAmountValue < 0) return 0
    if (!selectedUsdConversionCurrency || selectedUsdConversionRate <= 0) return 0
    const targetCode = String(usdConversion.targetCode || '').toUpperCase()
    if (targetCode === 'USD') return usdAmountValue
    if (erpBaseCurrencyCode === 'USD') {
      return usdAmountValue / selectedUsdConversionRate
    }
    if (!Number.isFinite(basePerUsd) || basePerUsd <= 0) return 0
    const baseAmount = usdAmountValue * basePerUsd
    return baseAmount / selectedUsdConversionRate
  })()
  const inventoryMappingProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryCatalogProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('recordType=product'))
  const legacyInventoryProducts = inventoryProducts.filter((item) => !String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryReportProducts = useMemo(() => {
    const catalog = inventoryProducts.filter((item) => String(item?.category || '').includes('recordType=product'))
    const legacy = inventoryProducts.filter((item) => !String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
    return [...catalog, ...legacy]
  }, [inventoryProducts])
  const inventoryReportRows = useMemo(() => {
    if (activeTab !== 'inventory') return []
    return inventoryReportProducts.map((item) => {
    const categoryMeta = decodeInventoryCategoryMeta(item.category)
    const productMeta = decodeInventoryCategoryPairs(item.category)
    const quantity = Math.max(0, Number(item.quantity || 0))
    const metalName = productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || ''
    const priceUnit = categoryMeta.priceUnit || productMeta.priceUnit || 'OZ'
    const storedUnitCost = Number(item.unitCost || 0)
    const unitCost = resolveInventoryValuationUnitCost(storedUnitCost, metalName, erpLiveMetalSnapshot, priceUnit)
    const usesLivePrice = unitCost !== storedUnitCost && unitCost > 0
    const stockValue = quantity * unitCost
    const minThreshold = Number(item.minThreshold || 0)
    const metal = titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || 'Unmapped')
    const categoryName = productMeta.productCategory || titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || item.name)
    const weight = Number(productMeta.grossWeight || productMeta.weight || item.weight || 0)
    const purity = productMeta.productPurity || productMeta.purity || categoryMeta.purity || ''
    const purityNumeric = Number(purity || 0)
    const purityFactor = purityNumeric > 1.2 ? purityNumeric / 1000 : purityNumeric
    const purityWeight = Number(productMeta.purityWeight || 0)
    const pureStockQty = Number.isFinite(purityFactor) && purityFactor > 0
      ? quantity * purityFactor
      : quantity
    const isZeroStock = quantity <= 0
    const isBelowMinStock = minThreshold > 0 && quantity <= minThreshold
    return {
      item,
      categoryMeta,
      productMeta,
      quantity,
      unitCost,
      storedUnitCost,
      usesLivePrice,
      stockValue,
      minThreshold,
      metal,
      categoryName,
      weight,
      purity,
      purityWeight,
      pureStockQty,
      stockUnit: item.unit || 'units',
      isZeroStock,
      isLowStock: isZeroStock || isBelowMinStock,
    }
    })
  }, [activeTab, inventoryReportProducts, erpLiveMetalSnapshot])
  const inventoryTotalQuantity = inventoryReportRows.reduce((sum, row) => sum + row.quantity, 0)
  const inventoryTotalValue = inventoryReportRows.reduce((sum, row) => sum + row.stockValue, 0)
  const inventoryLowStockCount = inventoryReportRows.filter((row) => row.isLowStock).length
  const inventoryTopProducts = [...inventoryReportRows]
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 5)
  const inventoryMetalBreakdown = Object.values(inventoryReportRows.reduce((groups, row) => {
    const key = row.metal || 'Unmapped'
    if (!groups[key]) {
      groups[key] = {
        metal: key,
        productCount: 0,
        totalQty: 0,
        totalValue: 0,
        lowStockCount: 0,
      }
    }
    groups[key].productCount += 1
    groups[key].totalQty += row.quantity
    groups[key].totalValue += row.stockValue
    groups[key].lowStockCount += row.isLowStock ? 1 : 0
    return groups
  }, {})).sort((a, b) => b.totalValue - a.totalValue)
  const inventoryStockTypeOptions = inventoryMappingProducts.map((item) => {
    const meta = decodeInventoryCategoryMeta(item.category)
    return {
      id: item._id,
      label: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      category: item.category,
      mainStock: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      purity: meta.purity || '',
    }
  })
  const fixingRegisterStockTypeOptions = useFixingRegisterStockTypeOptions({
    inventoryMappingProducts,
    inventoryCatalogProducts,
  })
  const selectedInventoryStockType = inventoryStockTypeOptions.find((item) => item.id === inventoryProductForm.stockTypeId) || null
  const inventoryPurityFactorRaw = Number(inventoryProductForm.purity || 0)
  const inventoryPurityFactor = inventoryPurityFactorRaw > 1 ? inventoryPurityFactorRaw / 1000 : inventoryPurityFactorRaw
  const inventoryProductPurityWeight = (Number(inventoryProductForm.weight || 0) || 0) * (Number.isFinite(inventoryPurityFactor) ? inventoryPurityFactor : 0)
  const inventoryProductsByMetal = inventoryReportRows.reduce((groups, row) => {
    const metalKey = row.metal || 'Unmapped'
    if (!groups[metalKey]) groups[metalKey] = []
    groups[metalKey].push({ item: row.item, meta: row.productMeta, row })
    return groups
  }, {})
  const inventoryTableRows = inventoryReportRows.map((row) => {
    const { item, categoryMeta, productMeta } = row
    const rawVatPercent = Number(productMeta.vatPercent)
    const vatPercent = Number.isFinite(rawVatPercent) ? Number(rawVatPercent.toFixed(2)) : null
    return { item, categoryMeta, productMeta, vatPercent, reportRow: row }
  })
  const filteredInventoryTableRows = inventoryTableRows.filter((row) => {
    if (inventoryVatFilter === 'with-vat') return (row.vatPercent ?? 0) > 0
    if (inventoryVatFilter === 'zero-or-blank') return row.vatPercent === null || row.vatPercent === 0
    return true
  })
  const sortedInventoryTableRows = [...filteredInventoryTableRows].sort((a, b) => {
    if (inventoryVatSortDir === 'none') return 0
    const aVat = a.vatPercent ?? -1
    const bVat = b.vatPercent ?? -1
    if (inventoryVatSortDir === 'asc') return aVat - bVat
    return bVat - aVat
  })
  const availableTransactionTypes = getAvailableTransactionTypes(user, user?.company || user?.tenant?.key || user?.tenant?.name)
  const selectedTransaction = transactions.find((tx) => tx._id === selectedTransactionId) || null
  const {
    rawStatementEntries,
    baseCurrencyCode,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    statementFilterCurrencyOptions,
    statementDisplayCurrencyOptions,
    statementMetalOptions,
    statementReferenceTypes,
    statementDepartments,
    filteredStatementEntries,
    modalPositionRows,
    formatStatementValue,
    formatStatementNullableValue,
    getSignedColor,
    convertStatementDisplayAmount,
    convertStatementEntryAmounts,
    resolveStatementReceiptNo,
    resolveMetalCode,
    pureWeightRunningByEntryKey,
    formatStatementDate,
    recentPaymentReceiptEntry,
    unfixedMetalEntries,
    fixedMetalSummary,
    unfixedMetalSummary,
    unknownFixMetalEntries,
    modalTotalFundsDisplay,
    modalRevaluationDisplay,
    modalNetEquityDisplay,
    modalMarginAmtDisplay,
    modalExcessDisplay,
    modalMarginPctDisplay,
    enquirySuppressMetalSpotMtm,
    enquiryLiveRecalcEnabled,
    hasMetalExposure,
  } = useAccountEnquiryStatement({
    activeTab,
    showEnquiryModal,
    accountEnquiryData,
    statementFilters,
    statementMetalCommodityEnabled,
    metalRates,
    erpBaseCurrencyCode,
    currencies,
    inventoryStockTypeOptions,
  })
  const {
    customerMarginSearch,
    setCustomerMarginSearch,
    customerMarginCompactView,
    setCustomerMarginCompactView,
    customerMarginSort,
    setCustomerMarginSort,
    customerMarginContextMenu,
    setCustomerMarginContextMenu,
    customerMarginRows,
    handleCustomerMarginRowContextMenu,
  } = useErpCustomerMargin({
    activeTab,
    customers,
    goldPriceUSD: erpGoldPriceUSD,
    silverPriceUSD: erpSilverPriceUSD,
    liveRecalcEnabled: activeTab === 'customer-margin',
  })
  const {
    supplierMarginSearch,
    setSupplierMarginSearch,
    supplierMarginCompactView,
    setSupplierMarginCompactView,
    supplierMarginSort,
    setSupplierMarginSort,
    supplierMarginContextMenu,
    setSupplierMarginContextMenu,
    supplierMarginRows,
    handleSupplierMarginRowContextMenu,
  } = useErpSupplierMargin({
    activeTab,
    vendors,
    goldPriceUSD: erpGoldPriceUSD,
    silverPriceUSD: erpSilverPriceUSD,
    liveRecalcEnabled: activeTab === 'supplier-margin',
  })
  useErpMarginContextMenuDismissal({
    customerMarginContextMenu,
    setCustomerMarginContextMenu,
    supplierMarginContextMenu,
    setSupplierMarginContextMenu,
  })

  const {
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryBackdropColor,
  } = useAccountEnquiryModalDrag(showEnquiryModal)

  const transactionPageCount = Math.max(1, Math.ceil(Number(transactionMeta.total || 0) / Number(transactionMeta.limit || 25)))
  const {
    fixingRegPanelOffset,
    fixingRegPanelDrag,
    beginFixingRegPanelDrag,
  } = useFixingRegisterPanelDrag(activeTab)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      setDetailsPanel((prev) => ({
        ...prev,
        pinned: Boolean(parsed.pinned),
        floating: Boolean(parsed.floating),
        x: Number.isFinite(parsed.x) ? parsed.x : prev.x,
        y: Number.isFinite(parsed.y) ? parsed.y : prev.y,
        width: Number.isFinite(parsed.width) ? parsed.width : prev.width,
        height: Number.isFinite(parsed.height) ? parsed.height : prev.height,
      }))
    } catch {
      // ignore malformed local settings
    }
  }, [setDetailsPanel])
  useEffect(() => {
    localStorage.setItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY, JSON.stringify(detailsPanel))
  }, [detailsPanel])
  useEffect(() => {
    setStatementAuditPreferenceReady(false)
    try {
      const raw = localStorage.getItem(statementAuditPreferenceKey)
      setShowStatementAuditIds(raw === '1')
    } catch {
      setShowStatementAuditIds(false)
    } finally {
      setStatementAuditPreferenceReady(true)
    }
  }, [statementAuditPreferenceKey, setShowStatementAuditIds, setStatementAuditPreferenceReady])
  useEffect(() => {
    if (!statementAuditPreferenceReady) return
    try {
      localStorage.setItem(statementAuditPreferenceKey, showStatementAuditIds ? '1' : '0')
    } catch {
      // ignore local preference save errors
    }
  }, [statementAuditPreferenceReady, statementAuditPreferenceKey, showStatementAuditIds])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(inventoryStockCodeSettingsKey)
      if (!raw) {
        setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
        return
      }
      const parsed = JSON.parse(raw)
      const format = parsed?.format === 'prefix-metal-purity' ? 'prefix-metal-purity' : 'metal-purity'
      const prefix = String(parsed?.prefix || DEFAULT_INVENTORY_STOCK_CODE_SETTINGS.prefix)
      setInventoryStockCodeSettings({ format, prefix })
    } catch {
      setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
    }
  }, [inventoryStockCodeSettingsKey, setInventoryStockCodeSettings])
  useEffect(() => {
    try {
      localStorage.setItem(inventoryStockCodeSettingsKey, JSON.stringify(inventoryStockCodeSettings))
    } catch {
      // ignore local preference save errors
    }
  }, [inventoryStockCodeSettingsKey, inventoryStockCodeSettings])
  const groupedSummaryAccounts = useMemo(() => safeSummaryAccounts
    .slice()
    .sort((a, b) => {
      const aType = String(a.accountType || '').trim()
      const bType = String(b.accountType || '').trim()
      const aTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(aType)
      const bTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(bType)
      const normalizedATypeIndex = aTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : aTypeIndex
      const normalizedBTypeIndex = bTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : bTypeIndex
      const typeCompare = normalizedATypeIndex - normalizedBTypeIndex
      if (typeCompare !== 0) return typeCompare
      return String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
    })
    .reduce((groups, account) => {
      const type = String(account.accountType || 'Other').trim() || 'Other'
      const existingGroup = groups.find((group) => group.type === type)
      if (existingGroup) existingGroup.accounts.push(account)
      else groups.push({ type, accounts: [account] })
      return groups
    }, []), [safeSummaryAccounts])
  const entryAccountOptions = useMemo(() => buildEntryAccountOptions({
    accounts: safeSummaryAccounts.length ? safeSummaryAccounts : accounts,
    customers,
    vendors,
  }), [safeSummaryAccounts, accounts, customers, vendors])
  const jvComboGroups = useMemo(() => ACCOUNT_TYPE_ORDER
    .map((type) => ({
      label: type,
      options: entryAccountOptions
        .filter((a) => String(a?.accountType || '').trim() === type)
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }))
    .concat([{
      label: 'Other',
      options: entryAccountOptions
        .filter((a) => !ACCOUNT_TYPE_ORDER.includes(String(a?.accountType || '').trim()))
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }])
    .filter((g) => g.options.length > 0), [entryAccountOptions])
  const isBankJvEligibleAccount = (account) => {
    const code = String(account?.accountCode || '').trim().toUpperCase()
    const name = String(account?.accountName || '').trim().toUpperCase()
    const type = String(account?.accountType || '').trim().toUpperCase()
    if (!code && !name) return false
    if (code === '1000' || name.includes('CASH ON HAND')) return true
    if (code === '4190' || name.includes('EXCHANGE GAIN')) return true
    if (code === '5190' || name.includes('EXCHANGE LOSS')) return true
    if (type.includes('BANK')) return true
    if (name.includes('BANK')) return true
    return /^101\d{0,3}$/.test(code)
  }
  const bankJvEntryAccountOptions = entryAccountOptions.filter(isBankJvEligibleAccount)
  const bankJvComboGroups = ACCOUNT_TYPE_ORDER
    .map((type) => ({
      label: type,
      options: bankJvEntryAccountOptions
        .filter((a) => String(a?.accountType || '').trim() === type)
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }))
    .concat([{
      label: 'Other',
      options: bankJvEntryAccountOptions
        .filter((a) => !ACCOUNT_TYPE_ORDER.includes(String(a?.accountType || '').trim()))
        .map((a) => ({ value: String(a._id), label: `${a.accountCode || ''} - ${a.accountName || ''}` })),
    }])
    .filter((g) => g.options.length > 0)
  const inferJvAccountCurrency = (accountId) => {
    const account = entryAccountOptions.find((item) => String(item?._id) === String(accountId || ''))
    if (!account) return erpBaseCurrencyCode
    const explicitCurrency = normalizeJvCurrencyCode(account.currency || account.currencyCode || '')
    if (explicitCurrency) return explicitCurrency
    const hint = `${String(account.accountCode || '').toUpperCase()} ${String(account.accountName || '').toUpperCase()}`
    if (hint.includes('USD')) return 'USD'
    if (hint.includes('UZS') || hint.includes('SOMS') || hint.includes('SOM')) return 'UZS'
    return erpBaseCurrencyCode
  }
  useEffect(() => {
    setJvHeader((prev) => {
      const nextCurrency = prev.currency || baseCurrencyCode
      return prev.currency === nextCurrency ? prev : { ...prev, currency: nextCurrency }
    })
  }, [baseCurrencyCode, setJvHeader])
  const filteredGroupedSummaryAccounts = groupedSummaryAccounts
    .map((group) => {
      const lookup = String(accountEnquiryCode || '').trim().toLowerCase()
      if (!lookup) return group
      const filteredAccounts = group.accounts.filter((account) => (
        [account.accountCode, account.accountName, account.accountType]
          .some((value) => String(value || '').toLowerCase().includes(lookup))
      ))
      return { ...group, accounts: filteredAccounts }
    })
    .filter((group) => group.accounts.length > 0)

  return {
    availableTransactionTypes,
    bankJvComboGroups,
    bankJvEntryAccountOptions,
    baseCurrencyCode,
    basePerUsd,
    beginEnquiryModalDrag,
    beginFixingRegPanelDrag,
    convertStatementDisplayAmount,
    convertStatementEntryAmounts,
    customerMarginCompactView,
    customerMarginContextMenu,
    customerMarginRows,
    customerMarginSearch,
    customerMarginSort,
    enquiryBackdropColor,
    enquiryLiveRecalcEnabled,
    enquiryModalDrag,
    enquiryModalOffset,
    enquirySuppressMetalSpotMtm,
    entryAccountOptions,
    filteredGroupedSummaryAccounts,
    filteredInventoryTableRows,
    filteredStatementEntries,
    fixedMetalSummary,
    fixingRegisterStockTypeOptions,
    fixingRegPanelDrag,
    fixingRegPanelOffset,
    formatStatementDate,
    formatStatementNullableValue,
    formatStatementValue,
    getSignedColor,
    groupedSummaryAccounts,
    handleCustomerMarginRowContextMenu,
    handleSupplierMarginRowContextMenu,
    hasMetalExposure,
    inferJvAccountCurrency,
    inventoryCatalogProducts,
    inventoryLowStockCount,
    inventoryMappingProducts,
    inventoryMetalBreakdown,
    inventoryProductPurityWeight,
    inventoryProductsByMetal,
    inventoryPurityFactor,
    inventoryPurityFactorRaw,
    inventoryReportProducts,
    inventoryReportRows,
    inventoryStockTypeOptions,
    inventoryTableRows,
    inventoryTopProducts,
    inventoryTotalQuantity,
    inventoryTotalValue,
    isBankJvEligibleAccount,
    jvComboGroups,
    legacyInventoryProducts,
    modalExcessDisplay,
    modalMarginAmtDisplay,
    modalMarginPctDisplay,
    modalNetEquityDisplay,
    modalPositionRows,
    modalRevaluationDisplay,
    modalTotalFundsDisplay,
    pureWeightRunningByEntryKey,
    rawStatementEntries,
    recentPaymentReceiptEntry,
    resolveMetalCode,
    resolvePreferredStatementMetalCode,
    resolveStatementReceiptNo,
    selectedInventoryStockType,
    selectedTransaction,
    selectedUsdConversionCurrency,
    selectedUsdConversionRate,
    setCustomerMarginCompactView,
    setCustomerMarginContextMenu,
    setCustomerMarginSearch,
    setCustomerMarginSort,
    setSupplierMarginCompactView,
    setSupplierMarginContextMenu,
    setSupplierMarginSearch,
    setSupplierMarginSort,
    sortedInventoryTableRows,
    statementDepartments,
    statementDisplayCurrency,
    statementDisplayCurrencyOptions,
    statementFilterCurrencyOptions,
    statementMetalOptions,
    statementReferenceTypes,
    statementSelectedMetalCode,
    supplierMarginCompactView,
    supplierMarginContextMenu,
    supplierMarginRows,
    supplierMarginSearch,
    supplierMarginSort,
    transactionPageCount,
    unfixedMetalEntries,
    unfixedMetalSummary,
    unknownFixMetalEntries,
    usdAmountValue,
    usdMasterRow,
    usdToTargetAmount,
  }
}

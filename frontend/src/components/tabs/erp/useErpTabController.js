import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useLanguage } from '../../../context/LanguageContext'
import { isLocalTenantHost } from '../../../config/tenantBranding'
import { resolveErpUserTenantBranding, resolveErpUserTenantKey } from './resolveErpUserTenant'
import {
  buildDashboardSearchParams,
  buildEnquiryHref,
} from '../../../utils/dashboardNavigation'
import erpAccountingAPI from '../../../api/erp-accounting'
import { buildEntryAccountOptions, filterActiveAccounts } from './accountDropdownHelpers'
import { ACCOUNT_TYPES } from '../../../constants/accountTypes'
import {
  LEDGER_REFERENCE_TYPES,
  LEDGER_DEPARTMENTS,
  ENQUIRY_DETAILS_PANEL_STORAGE_KEY,
  ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY,
  INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY,
  ACCOUNT_TYPE_ORDER,
  ERP_DASH_ALL_WIDGETS,
  DEFAULT_METAL_RATES,
} from '../erpTabConstants'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from '../transactionWorkflow'
import { useERPTabStateAdapter } from './useERPTabStateAdapter'
import { useErpDashUiState } from './useErpDashUiState'
import { useErpDashWidgetData } from './useErpDashWidgetData'
import { useFixingRegisterPanelDrag } from './useFixingRegisterPanelDrag'
import { useFixingRegisterState } from './useFixingRegisterState'
import { useJvFormState } from './useJvFormState'
import { useJvModalChrome } from './useJvModalChrome'
import { useFixingRegisterStockTypeOptions } from './useFixingRegisterStockTypeOptions'
import { ERP_TAB_COLORS as C, TRANSACTION_STATUS_STYLES, ERP_EMPTY_CARD_STYLE, ERP_MODAL_BACKDROP_STYLE, ERP_MODAL_CARD_STYLE, ERP_MODAL_INPUT_STYLE } from './erpTabPresentation'
import { useTransactionComposer } from './useTransactionComposer'
import { useJournalVoucher } from './useJournalVoucher'
import { useAccountEnquiryStatement } from './accountEnquiry/useAccountEnquiryStatement'
import { useAccountEnquiryModalDrag } from './accountEnquiry/useAccountEnquiryModalDrag'
import { useEnquiryDeepLinkEffects } from './accountEnquiry/useEnquiryDeepLinkEffects'
import {
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
} from './fixingRegisterUtils'

import { deriveErpAccessPolicy, getAvailableTransactionTypes } from './accessPolicy'
import {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  createInventoryMappingForm,
  createInventoryProductForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
} from './erpTabUtils'
import { useErpEnquiryMetalRatesSync } from './useErpMetalRatesRealtime'
import { useErpLiveMetalSpotPrices } from './useErpLiveMetalSpotPrices'
import useLiveMetalRates from '../../../hooks/useLiveMetalRates'
import { useErpCustomers } from './useErpCustomers'
import { useErpMappings } from './useErpMappings'
import { useErpCurrencies } from './useErpCurrencies'
import { useErpCustomerMargin, useErpSupplierMargin, useErpMarginContextMenuDismissal } from './useErpMarginTabs'
import { useErpReportsController } from './useErpReportsController'
import { useErpTransactionWorkflow } from './useErpTransactionWorkflow'
import { useErpVoucherSource } from './useErpVoucherSource'

import {
  liveRatesToMetalRatesState,
  resolveInventoryValuationUnitCost,
} from '../../../utils/liveMetalRates'
import {
  formatAccountEnquiryExcessDisplay,
  getAccountEnquirySignedMetricColor,
  resolveExposureDirection,
  isMetalStatementEntry,
} from './statementHelpers'
import { generateStatementHtml as buildStatementHtml } from './statementPrintHtml'
import {
  canViewErpSubTab,
} from '../../../utils/erpSubTabPermissions'
import {
  JV_MODE_META,
  buildJvDocNo as buildNextJvDocNo,
  convertJvAmountBetweenCurrencies,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
} from './journalVoucherHelpers'
import {
  DEFAULT_BRANDING,
  DEFAULT_BRANDING_PROFILES,
  clampBrandingDimension,
} from './ERPBrandingUtils'
import { resolveDocumentBranding } from './documentBranding'
import { exchangeRateFromUnitsPerBase, resolveCurrencyRowByCode } from './erpCurrencyRowHelpers'
import { buildBrandingLogoTag as buildBrandingLogoTagHelper, openPrintWindow as openPrintWindowHelper } from './erpPrintHelpers'
import { useErpAccountEnquiryController } from './useErpAccountEnquiryController'
import { useErpTabRouter } from './useErpTabRouter'
import { useErpLedger } from './useErpLedger'
import { useErpLedgerActions } from './useErpLedgerActions'
import { useErpVendors } from './useErpVendors'
import { useErpInventory } from './useErpInventory'
import { useErpAccounts } from './useErpAccounts'
import { useErpVendorActions } from './useErpVendorActions'
import { useErpInventoryActions } from './useErpInventoryActions'
import { useErpBranding } from './useErpBranding'
import { useErpTransactions } from './useErpTransactions'
import { useErpExportActions } from './useErpExportActions'
import { useErpReferenceCrud } from './useErpReferenceCrud'
import { useErpTransactionNavigation } from './useErpTransactionNavigation'
import { useErpTabBindings } from './useErpTabBindings'
import { useErpTabCoreSlice } from './controllerSlices/useErpTabCoreSlice'
import { useErpTabCatalogSlice } from './controllerSlices/useErpTabCatalogSlice'
import { useErpTabDomainActionsSlice } from './controllerSlices/useErpTabDomainActionsSlice'
import { useErpTabPresentationSlice } from './controllerSlices/useErpTabPresentationSlice'
import { ERP_TAB_SCOPE_STATICS } from './erpTabScopeStatics'
import { EMPTY_VENDOR_DOCUMENT_FORM, EMPTY_VENDOR_FORM } from './vendorFormDefaults'



export function useErpTabController({
  focusTab,
  onNavigateMain,
  onErpSubTabChange,
  jumpToTransactionId = null,
  onJumpToTransactionConsumed,
  jumpToVoucher = null,
  onJumpToVoucherConsumed,
  jumpToEnquiryAccountCode = null,
  onJumpToEnquiryConsumed,
}) {
  const core = useErpTabCoreSlice({
    focusTab,
    onNavigateMain,
    onErpSubTabChange,
    jumpToTransactionId,
    onJumpToTransactionConsumed,
    jumpToVoucher,
    onJumpToVoucherConsumed,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
  })
  const catalog = useErpTabCatalogSlice(core)
  const domain = useErpTabDomainActionsSlice({ ...core, ...catalog })
  const presentation = useErpTabPresentationSlice({ ...core, ...catalog, ...domain })
  const scope = {
    ...ERP_TAB_SCOPE_STATICS,
    ...core,
    ...catalog,
    ...domain,
    ...presentation,
  }
  const { panelProps, modalProps } = useErpTabBindings(scope)

  return {
    panelProps,
    modalProps,
    canAccessERP: scope.canAccessERP,
    canViewCurrentErpSubTab: scope.canViewCurrentErpSubTab,
    token: scope.token,
    error: scope.error,
    success: scope.success,
    C: scope.C,
  }
}

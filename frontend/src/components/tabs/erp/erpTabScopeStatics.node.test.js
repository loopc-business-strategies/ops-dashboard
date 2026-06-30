import { describe, expect, test } from 'vitest'
import { ERP_TAB_SCOPE_STATICS } from './erpTabScopeStatics'
import { buildErpTabModalProps } from './buildErpTabModalProps'

const ENQUIRY_MODAL_HELPER_KEYS = [
  'getAccountEnquirySignedMetricColor',
  'formatAccountEnquiryExcessDisplay',
  'resolveExposureDirection',
  'isMetalStatementEntry',
]

describe('erpTabScopeStatics (node)', () => {
  test('exports account enquiry statement helpers as functions', () => {
    for (const key of ENQUIRY_MODAL_HELPER_KEYS) {
      expect(typeof ERP_TAB_SCOPE_STATICS[key]).toBe('function')
    }
  })

  test('buildErpTabModalProps passes enquiry helpers from merged scope', () => {
    const modalProps = buildErpTabModalProps({
      ...ERP_TAB_SCOPE_STATICS,
      showMappingTest: false,
      setShowMappingTest: () => {},
      testMapping: null,
      showEnquiryModal: false,
      setShowEnquiryModal: () => {},
      enquiryBackdropColor: 'rgba(0,0,0,0.5)',
      enquiryModalOffset: { x: 0, y: 0 },
      enquiryModalDrag: { active: false },
      beginEnquiryModalDrag: () => {},
      enquiryLoading: false,
      accountEnquiryCode: '',
      setAccountEnquiryCode: () => {},
      setShowEnquiryLookupMenu: () => {},
      showEnquiryLookupMenu: false,
      filteredGroupedSummaryAccounts: [],
      setEnquiryStatus: () => {},
      fetchAccountEnquiryByCode: async () => {},
      enquiryStatus: { type: '', message: '' },
      accountEnquiryData: null,
      modalPositionRows: [],
      formatStatementValue: () => '',
      getSignedColor: () => '#000',
      formatDirectionalBalance: () => '',
      unfixedMetalEntries: [],
      formatStatementDate: () => '',
      fixedMetalSummary: null,
      unfixedMetalSummary: null,
      unknownFixMetalEntries: [],
      modalTotalFundsDisplay: 0,
      modalRevaluationDisplay: 0,
      modalNetEquityDisplay: 0,
      modalMarginAmtDisplay: 0,
      modalExcessDisplay: 0,
      modalMarginPctDisplay: 0,
      enquirySuppressMetalSpotMtm: false,
      enquiryLiveRecalcEnabled: false,
      hasMetalExposure: false,
      excessCurrency: '',
      setExcessCurrency: () => {},
      baseCurrencyCode: 'USD',
      statementDisplayCurrencyOptions: [],
      filteredStatementEntries: [],
      recentPaymentReceiptEntry: null,
      resolveStatementReceiptNo: () => '-',
      statementFilters: {},
      setStatementFilters: () => {},
      statementReferenceTypes: [],
      statementDepartments: [],
      setStatementMetalCommodityEnabled: () => {},
      statementMetalCommodityEnabled: false,
      statementFilterCurrencyOptions: [],
      statementMetalOptions: [],
      statementDisplayCurrency: 'USD',
      showStatementAuditIds: false,
      setShowStatementAuditIds: () => {},
      statementTableRef: { current: null },
      convertStatementDisplayAmount: (v) => v,
      resolveMetalCode: () => '',
      statementSelectedMetalCode: 'XAU',
      pureWeightRunningByEntryKey: new Map(),
      formatStatementNullableValue: () => '-',
      canExportAccountSummary: true,
      handleViewStatement: async () => {},
      buildAccountEnquiryHref: () => '#',
      handleExportEnquiryPdf: async () => {},
      showStatementPreview: false,
      setShowStatementPreview: () => {},
      statementPreviewTitle: '',
      statementPreviewHtml: '',
      statementPreviewLoading: false,
      exportOptionsOpen: false,
      setExportOptionsOpen: () => {},
      handlePrintStatement: async () => {},
      handleDownloadStatementPdf: async () => {},
    })

    for (const key of ENQUIRY_MODAL_HELPER_KEYS) {
      expect(typeof modalProps[key]).toBe('function')
    }
  })
})

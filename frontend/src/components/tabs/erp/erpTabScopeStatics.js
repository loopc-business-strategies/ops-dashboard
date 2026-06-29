import { ACCOUNT_TYPES } from '../../../constants/accountTypes'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from '../transactionWorkflow'
import {
  ERP_DASH_ALL_WIDGETS,
  LEDGER_DEPARTMENTS,
  LEDGER_REFERENCE_TYPES,
} from '../erpTabConstants'
import {
  ERP_TAB_COLORS as C,
  ERP_EMPTY_CARD_STYLE,
  ERP_MODAL_BACKDROP_STYLE,
  ERP_MODAL_CARD_STYLE,
  ERP_MODAL_INPUT_STYLE,
  TRANSACTION_STATUS_STYLES,
} from './erpTabPresentation'
import {
  createInventoryMappingForm,
  decodeInventoryCategoryMeta,
  formatVatPercent,
  titleCaseWords,
} from './erpTabUtils'
import {
  fixingRegFmtAmt,
  fixingRegFmtQty,
  fixingRegFmtRate,
} from './fixingRegisterUtils'
import { JV_MODE_META } from './journalVoucherHelpers'

/** Imported constants and pure helpers merged into useErpTabController scope (not slice returns). */
export const ERP_TAB_SCOPE_STATICS = {
  ACCOUNT_TYPES,
  C,
  ERP_DASH_ALL_WIDGETS,
  ERP_EMPTY_CARD_STYLE,
  ERP_MODAL_BACKDROP_STYLE,
  ERP_MODAL_CARD_STYLE,
  ERP_MODAL_INPUT_STYLE,
  JV_MODE_META,
  LEDGER_DEPARTMENTS,
  LEDGER_REFERENCE_TYPES,
  TRANSACTION_STATUS_STYLES,
  createInventoryMappingForm,
  decodeInventoryCategoryMeta,
  fixingRegFmtAmt,
  fixingRegFmtQty,
  fixingRegFmtRate,
  formatTransactionAuditEntry,
  formatTransactionCommentKind,
  formatVatPercent,
  getTransactionBulkSelectionLabel,
  titleCaseWords,
}

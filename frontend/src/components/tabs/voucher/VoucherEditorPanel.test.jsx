import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VoucherEditorPanel from './VoucherEditorPanel'

vi.mock('../../AccountCombobox', () => ({
  default: () => <div>AccountCombobox</div>,
}))

vi.mock('../erp/VoucherAttachmentsPanel', () => ({
  default: () => <div>Attachments</div>,
}))

const minimalProps = {
  applyLineAutoCalc: vi.fn(),
  applyProductTypeAutoFill: vi.fn(),
  attachmentInputKey: '1',
  baseCurrencyCode: 'USD',
  canApproveWorkflow: false,
  canCreate: true,
  canDeleteCurrentVoucher: false,
  canPostWorkflow: false,
  canRejectWorkflow: false,
  canReturnWorkflow: false,
  canRevalueCurrentVoucher: false,
  canSubmitWorkflow: false,
  cancelLine: vi.fn(),
  currencyOptions: [{ code: 'USD', name: 'US Dollar', exchangeRate: 1 }],
  currentAttachments: [],
  currentVoucher: null,
  currentVoucherStatus: '',
  editingId: null,
  editingLineIdx: null,
  formReadOnly: false,
  handleAddLineClick: vi.fn(),
  handleAmountFC: vi.fn(),
  handleAmountLC: vi.fn(),
  handleBarcodeAction: vi.fn(),
  handleCancelChanges: vi.fn(),
  handleCurrRateChange: vi.fn(),
  handleDeleteLineClick: vi.fn(),
  handleDeleteVoucher: vi.fn(),
  handleDeleteVoucherAttachment: vi.fn(),
  handleEditLineClick: vi.fn(),
  handleEditUnlock: vi.fn(),
  handleExitVoucherForm: vi.fn(),
  handleHeaderCurrRateChange: vi.fn(),
  handleHeaderCurrencyChange: vi.fn(),
  handleLineAcCodeChange: vi.fn(),
  handleLineAmountEnter: vi.fn(),
  handleLineCurrencyChange: vi.fn(),
  handleLineTypeChange: vi.fn(),
  handleModalHeaderMouseDown: vi.fn(),
  handlePartyCodeEnter: vi.fn(),
  handlePartySelect: vi.fn(),
  handlePreviewVoucherAttachment: vi.fn(),
  handleRevalueFxJournal: vi.fn(),
  handleSearchFind: vi.fn(),
  handleStockSelection: vi.fn(),
  handleUploadVoucherAttachments: vi.fn(),
  handleVoucherModalBackdropClick: vi.fn(),
  handleWorkflowAction: vi.fn(),
  header: { currCode: 'USD', docDate: '2026-07-08' },
  inventoryProducts: [],
  inventoryStockOptions: [],
  isMetalVoucher: false,
  isReadOnly: false,
  isSimpleMetalVoucher: false,
  lineAccountComboGroups: [],
  lineForm: {},
  lineItems: [],
  lineTableHeaders: [],
  loadingInventoryProducts: false,
  loadingRecentPartyVouchers: false,
  menuTab: 'header',
  metalPartyComboGroups: [],
  modalDrag: false,
  modalOffset: { x: 0, y: 0 },
  mode: 'create',
  navFirst: vi.fn(),
  navLast: vi.fn(),
  navNext: vi.fn(),
  navPrev: vi.fn(),
  openAddLine: vi.fn(),
  openCreate: vi.fn(),
  partyComboGroups: [],
  receiptPaymentNetAmtLabelCurrency: 'USD',
  recentPartyVouchers: [],
  refreshParties: vi.fn(),
  resolveVoucherParty: vi.fn(),
  runToolbarAction: (_label, action) => action?.(),
  saveLine: vi.fn(),
  saveVoucher: vi.fn(),
  saving: false,
  searchPartyByCode: vi.fn(),
  selectedPartyId: '',
  setHdr: vi.fn(),
  setLF: vi.fn(),
  setLineForm: vi.fn(),
  setMenuTab: vi.fn(),
  setMode: vi.fn(),
  setWorkflowNote: vi.fn(),
  showAccountDetailsTab: false,
  showLineForm: false,
  t: (key) => key,
  totals: { grandTotal: 0 },
  voucherCode: 'PAY',
  voucherConfig: { label: 'Payment Voucher' },
  voucherLabel: 'Payment Voucher',
  voucherLabelT: 'Payment Voucher',
  voucherType: 'payment',
  vouchers: [],
  workflowNote: '',
}

describe('VoucherEditorPanel print preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.print = vi.fn()
  })

  it('uses onPrintPreview callback when provided', () => {
    const onPrintPreview = vi.fn()
    render(<VoucherEditorPanel {...minimalProps} onPrintPreview={onPrintPreview} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Print/Preview' }), { button: 0 })
    expect(onPrintPreview).toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
  })

  it('falls back to window.print when callback is not provided', () => {
    render(<VoucherEditorPanel {...minimalProps} />)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Print/Preview' }), { button: 0 })
    expect(window.print).toHaveBeenCalled()
  })
})

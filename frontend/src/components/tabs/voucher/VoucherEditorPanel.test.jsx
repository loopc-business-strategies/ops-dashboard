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
  canCreate: true,
  canDeleteCurrentVoucher: false,
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
  isProductTransferVoucher: false,
  lineAccountComboGroups: [],
  lineForm: {},
  lineItems: [],
  setLineItems: vi.fn(),
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

describe('VoucherEditorPanel toolbar', () => {
  it('does not show Cancel, Barcode, Parties or Exit buttons', () => {
    render(<VoucherEditorPanel {...minimalProps} />)
    for (const name of ['New', 'Edit', 'Delete', 'Save', 'Print/Preview', 'Search/Find']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
    for (const tip of [/^Cancel —/, /^Barcode —/, /^Refresh Parties —/, /^Exit —/]) {
      expect(screen.queryByTitle(tip)).toBeNull()
    }
  })

  it('renders toolbar buttons as icons with tooltips and no visible text', () => {
    render(<VoucherEditorPanel {...minimalProps} />)
    for (const name of ['New', 'Edit', 'Delete', 'Save', 'First', 'Previous', 'Next', 'Last', 'Print/Preview', 'Search/Find']) {
      const button = screen.getByRole('button', { name })
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg')).toBeTruthy()
      expect(button.getAttribute('title')).toMatch(new RegExp(`^${name.replace('/', '\\/')} —`))
    }
  })
})

describe('VoucherEditorPanel party details', () => {
  it('shows the selected party on one compact line', () => {
    render(
      <VoucherEditorPanel
        {...minimalProps}
        header={{ ...minimalProps.header, partyCode: 'V001' }}
        resolveVoucherParty={() => ({ partyName: 'Acme Metals', partyType: 'vendor', phone: '+998 90 000', email: 'a@acme.uz', address: '' })}
      />,
    )
    expect(screen.getByText('Acme Metals')).toBeTruthy()
    expect(screen.getByText('Vendor')).toBeTruthy()
    expect(screen.getByText('+998 90 000 · a@acme.uz')).toBeTruthy()
    expect(screen.queryByText('Email')).toBeNull()
    expect(screen.getAllByDisplayValue('V001')).toHaveLength(1)
  })

  it('hides the party line when no party is selected', () => {
    render(<VoucherEditorPanel {...minimalProps} />)
    expect(screen.queryByText('No party selected')).toBeNull()
    expect(screen.getByRole('button', { name: 'Search party by code' })).toBeTruthy()
  })
})

describe('VoucherEditorPanel workflow', () => {
  it('shows Submit only and hides Approve and Post', () => {
    render(
      <VoucherEditorPanel
        {...minimalProps}
        editingId="tx1"
        currentVoucherStatus="draft"
        canSubmitWorkflow
      />,
    )
    expect(screen.getByRole('button', { name: 'submit' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'approve' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'post' })).toBeNull()
  })
})

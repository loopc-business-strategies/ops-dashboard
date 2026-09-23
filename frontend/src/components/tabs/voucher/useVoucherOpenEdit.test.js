import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { isVoucherOpenInEdit, useVoucherOpenEdit } from './useVoucherOpenEdit'

function makeDeps(overrides = {}) {
  const lastViewedIdRef = { current: null }
  const initialFormSnapshotRef = { current: null }
  return {
    mode: 'list',
    editingId: null,
    header: { partyCode: '', narration: '' },
    lineItems: [],
    voucherType: 'payment',
    tenantKey: 'loopc',
    lastViewedIdRef,
    buildFormSnapshot: vi.fn(() => 'snap'),
    fetchServerNextVocNo: vi.fn(async () => 'Pay-2026-0001'),
    resolveNextVocNo: vi.fn(() => 'Pay-2026-0002'),
    sortVouchers: (txs) => txs,
    voucherErpApi: {
      getTransactions: vi.fn(),
    },
    token: 'tok',
    setEditingId: vi.fn(),
    setHeader: vi.fn(),
    setSelectedPartyId: vi.fn(),
    setRecentPartyVouchers: vi.fn(),
    setLineItems: vi.fn(),
    setShowLineForm: vi.fn(),
    setMenuTab: vi.fn(),
    setWorkflowNote: vi.fn(),
    setModalOffset: vi.fn(),
    setModalDrag: vi.fn(),
    setError: vi.fn(),
    setMode: vi.fn(),
    setVouchers: vi.fn(),
    setVoucherType: vi.fn(),
    loadVouchers: vi.fn(),
    resolveVoucherParty: vi.fn(() => null),
    findPartyOptionByCode: vi.fn(() => null),
    initialFormSnapshotRef,
    baseCurrencyCode: 'USD',
    isReadOnly: false,
    isEntryLocked: () => false,
    ...overrides,
  }
}

function postedTx(id = 'posted-1') {
  return {
    _id: id,
    status: 'posted',
    type: 'payment',
    currency: 'USD',
    exchangeRate: 1,
    date: '2026-09-23',
    voucherMeta: { vocNo: 'Pay-2026-0009', partyCode: 'V1', partyName: 'Vendor' },
  }
}

function draftTx(id = 'draft-1') {
  return {
    _id: id,
    status: 'draft',
    type: 'payment',
    currency: 'USD',
    exchangeRate: 1,
    date: '2026-09-23',
    voucherMeta: { vocNo: 'Pay-2026-0010', partyCode: '', partyName: '' },
  }
}

describe('isVoucherOpenInEdit', () => {
  test('allows draft/returned/rejected when unlocked', () => {
    expect(isVoucherOpenInEdit({ status: 'draft' })).toBe(true)
    expect(isVoucherOpenInEdit({ status: 'returned' })).toBe(true)
    expect(isVoucherOpenInEdit({ status: 'rejected' })).toBe(true)
  })

  test('blocks posted and locked vouchers', () => {
    expect(isVoucherOpenInEdit({ status: 'posted' })).toBe(false)
    expect(isVoucherOpenInEdit({ status: 'submitted' })).toBe(false)
    expect(isVoucherOpenInEdit({ status: 'draft' }, { isReadOnly: true })).toBe(false)
    expect(isVoucherOpenInEdit({ status: 'draft' }, { isEntryLocked: () => true })).toBe(false)
  })
})

describe('useVoucherOpenEdit openLastOrCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('opens blank create when latest voucher is posted', async () => {
    const deps = makeDeps()
    deps.voucherErpApi.getTransactions.mockResolvedValue({
      transactions: [postedTx()],
    })

    const { result } = renderHook(() => useVoucherOpenEdit(deps))

    await act(async () => {
      await result.current.openLastOrCreate('payment')
    })

    expect(deps.setVouchers).toHaveBeenCalledWith([expect.objectContaining({ _id: 'posted-1' })])
    expect(deps.setEditingId).toHaveBeenCalledWith(null)
    expect(deps.setMode).toHaveBeenCalledWith('create')
    expect(deps.setSelectedPartyId).toHaveBeenCalledWith('')
  })

  test('opens latest draft in edit-ready mode', async () => {
    const deps = makeDeps()
    deps.voucherErpApi.getTransactions.mockResolvedValue({
      transactions: [draftTx()],
    })

    const { result } = renderHook(() => useVoucherOpenEdit(deps))

    await act(async () => {
      await result.current.openLastOrCreate('payment')
    })

    expect(deps.setEditingId).toHaveBeenCalledWith('draft-1')
    expect(deps.setMode).toHaveBeenCalledWith('create')
  })
})

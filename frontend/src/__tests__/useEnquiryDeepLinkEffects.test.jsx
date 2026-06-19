import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useEnquiryDeepLinkEffects } from '../components/tabs/erp/accountEnquiry/useEnquiryDeepLinkEffects'

describe('useEnquiryDeepLinkEffects', () => {
  const fetchAccountEnquiryByCode = vi.fn().mockResolvedValue(undefined)
  const onJumpToEnquiryConsumed = vi.fn()
  const setActiveTabGuarded = vi.fn()
  const lastEnquiryDeepLinkKeyRef = { current: '' }

  beforeEach(() => {
    vi.clearAllMocks()
    lastEnquiryDeepLinkKeyRef.current = ''
  })

  it('loads account from URL deep link once per account/view key', () => {
    const searchParams = new URLSearchParams('tab=erp-enquiry&account=1000&view=statement')

    const { rerender } = renderHook(
      ({ search }) => useEnquiryDeepLinkEffects({
        activeTab: 'enquiry',
        searchParams: search,
        lastEnquiryDeepLinkKeyRef,
        fetchAccountEnquiryByCode,
        jumpToEnquiryAccountCode: null,
        onJumpToEnquiryConsumed,
        setActiveTabGuarded,
      }),
      { initialProps: { search: searchParams } },
    )

    expect(fetchAccountEnquiryByCode).toHaveBeenCalledTimes(1)
    expect(fetchAccountEnquiryByCode).toHaveBeenCalledWith('1000', {
      openModal: true,
      openStatementPreview: true,
    })

    rerender({ search: new URLSearchParams('tab=erp-enquiry&account=1000&view=statement&company=mg') })
    expect(fetchAccountEnquiryByCode).toHaveBeenCalledTimes(1)
  })

  it('notification jump loads enquiry tab and consumes jump id', async () => {
    renderHook(() => useEnquiryDeepLinkEffects({
      activeTab: 'ledger',
      searchParams: new URLSearchParams('tab=erp-ledger'),
      lastEnquiryDeepLinkKeyRef,
      fetchAccountEnquiryByCode,
      jumpToEnquiryAccountCode: '2100',
      onJumpToEnquiryConsumed,
      setActiveTabGuarded,
    }))

    await waitFor(() => {
      expect(setActiveTabGuarded).toHaveBeenCalledWith('enquiry')
      expect(fetchAccountEnquiryByCode).toHaveBeenCalledWith('2100', { openModal: true })
      expect(onJumpToEnquiryConsumed).toHaveBeenCalled()
    })
  })
})

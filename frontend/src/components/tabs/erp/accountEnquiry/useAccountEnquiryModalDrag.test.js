import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountEnquiryModalDrag } from './useAccountEnquiryModalDrag'

describe('useAccountEnquiryModalDrag', () => {
  it('does not start drag from header close button', () => {
    const { result } = renderHook(() => useAccountEnquiryModalDrag(true))
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-label', 'Close account summary')
    button.textContent = '✕'
    document.body.appendChild(button)

    act(() => {
      result.current.beginEnquiryModalDrag({
        button: 0,
        target: button,
        clientX: 10,
        clientY: 20,
        preventDefault: vi.fn(),
      })
    })

    expect(result.current.enquiryModalDrag.active).toBe(false)
    button.remove()
  })

  it('starts drag from non-interactive header surface', () => {
    const { result } = renderHook(() => useAccountEnquiryModalDrag(true))
    const header = document.createElement('div')
    document.body.appendChild(header)
    const preventDefault = vi.fn()

    act(() => {
      result.current.beginEnquiryModalDrag({
        button: 0,
        target: header,
        clientX: 12,
        clientY: 24,
        preventDefault,
      })
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(result.current.enquiryModalDrag.active).toBe(true)
    header.remove()
  })
})

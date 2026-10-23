import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFloatingModalChrome } from './useFloatingModalChrome'

describe('useFloatingModalChrome', () => {
  it('starts drag from non-interactive surface and updates offset', () => {
    const { result } = renderHook(() => useFloatingModalChrome({ open: true, defaultWidth: 640 }))
    const surface = document.createElement('div')
    document.body.appendChild(surface)
    const preventDefault = vi.fn()

    act(() => {
      result.current.beginDrag({
        button: 0,
        target: surface,
        clientX: 100,
        clientY: 100,
        preventDefault,
      })
    })
    expect(preventDefault).toHaveBeenCalled()
    expect(result.current.isDragging).toBe(true)

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 140, clientY: 130 }))
    })
    expect(result.current.offset).toEqual({ x: 40, y: 30 })

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'))
    })
    expect(result.current.isDragging).toBe(false)
    surface.remove()
  })

  it('resizes from bottom-right handle', () => {
    const { result } = renderHook(() => useFloatingModalChrome({
      open: true,
      defaultWidth: 640,
      defaultHeightRatio: 0.5,
      minWidth: 400,
      minHeight: 200,
    }))
    const startW = result.current.size.width
    const startH = result.current.size.height
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()

    act(() => {
      result.current.beginResize({
        button: 0,
        clientX: 200,
        clientY: 200,
        preventDefault,
        stopPropagation,
      })
    })
    expect(result.current.isResizing).toBe(true)

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 280, clientY: 260 }))
    })
    expect(result.current.size.width).toBe(startW + 80)
    expect(result.current.size.height).toBe(startH + 60)

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'))
    })
    expect(result.current.isResizing).toBe(false)
  })

  it('does not start drag from buttons', () => {
    const { result } = renderHook(() => useFloatingModalChrome({ open: true }))
    const button = document.createElement('button')
    document.body.appendChild(button)
    act(() => {
      result.current.beginDrag({
        button: 0,
        target: button,
        clientX: 1,
        clientY: 1,
        preventDefault: vi.fn(),
      })
    })
    expect(result.current.isDragging).toBe(false)
    button.remove()
  })
})

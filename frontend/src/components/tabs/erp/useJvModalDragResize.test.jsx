import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useJvModalDragResize } from './useJvModalDragResize'

const JV_MODAL_DEFAULT_SIZE = { width: 1100, height: 700 }

function JvModalDragResizeHarness({ onClose = vi.fn() }) {
  const [jvModalOffset, setJvModalOffset] = useState({ x: 0, y: 0 })
  const [jvModalDrag, setJvModalDrag] = useState({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
  })
  const [jvModalSize, setJvModalSize] = useState(JV_MODAL_DEFAULT_SIZE)
  const [jvModalResize, setJvModalResize] = useState({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startW: JV_MODAL_DEFAULT_SIZE.width,
    startH: JV_MODAL_DEFAULT_SIZE.height,
  })

  const { beginJvModalDrag, beginJvModalResize, canCloseOnBackdropClick } = useJvModalDragResize({
    showLedgerForm: true,
    jvModalDrag,
    setJvModalDrag,
    jvModalOffset,
    setJvModalOffset,
    jvModalResize,
    setJvModalResize,
    jvModalSize,
    setJvModalSize,
    jvModalDefaultSize: JV_MODAL_DEFAULT_SIZE,
  })

  return (
    <div>
      <div
        data-testid="backdrop"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          if (!canCloseOnBackdropClick()) return
          onClose()
        }}
      />
      <div data-testid="drag-handle" onMouseDown={beginJvModalDrag} />
      <div data-testid="resize-handle" onMouseDown={beginJvModalResize} />
    </div>
  )
}

describe('useJvModalDragResize', () => {
  it('does not close backdrop immediately after resize ends', () => {
    const onClose = vi.fn()
    render(<JvModalDragResizeHarness onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId('resize-handle'), { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 150, clientY: 150 })
    fireEvent.mouseUp(window)
    fireEvent.click(screen.getByTestId('backdrop'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close backdrop immediately after drag ends', () => {
    const onClose = vi.fn()
    render(<JvModalDragResizeHarness onClose={onClose} />)
    fireEvent.mouseDown(screen.getByTestId('drag-handle'), { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(window, { clientX: 160, clientY: 140 })
    fireEvent.mouseUp(window)
    fireEvent.click(screen.getByTestId('backdrop'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('allows backdrop close when not dragging or resizing', () => {
    const onClose = vi.fn()
    render(<JvModalDragResizeHarness onClose={onClose} />)
    fireEvent.click(screen.getByTestId('backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

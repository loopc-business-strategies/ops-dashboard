import { useState } from 'react'
import { JV_MODAL_DEFAULT_SIZE } from '../erpTabConstants'
import { resolveFloatingModalOpenSize } from './useFloatingModalChrome'
import { useJvModalDragResize } from './useJvModalDragResize'

const JV_MODAL_PERSIST_KEY = 'erp-journal-voucher'
const JV_MODAL_MIN_WIDTH = 860
const JV_MODAL_MIN_HEIGHT = 500

/**
 * JV modal position, size, drag/resize state + handlers (extracted from ERPTab).
 */
export function useJvModalChrome(showLedgerForm) {
  const [jvModalOffset, setJvModalOffset] = useState({ x: 0, y: 0 })
  const [jvModalDrag, setJvModalDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [jvModalSize, setJvModalSize] = useState(() => resolveFloatingModalOpenSize({
    persistKey: JV_MODAL_PERSIST_KEY,
    getDefaultSize: () => JV_MODAL_DEFAULT_SIZE,
    minWidth: JV_MODAL_MIN_WIDTH,
    minHeight: JV_MODAL_MIN_HEIGHT,
  }))
  const [jvModalResize, setJvModalResize] = useState({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startW: JV_MODAL_DEFAULT_SIZE.width,
    startH: JV_MODAL_DEFAULT_SIZE.height,
  })

  const { beginJvModalDrag, beginJvModalResize, canCloseOnBackdropClick } = useJvModalDragResize({
    showLedgerForm,
    jvModalDrag,
    setJvModalDrag,
    jvModalOffset,
    setJvModalOffset,
    jvModalResize,
    setJvModalResize,
    jvModalSize,
    setJvModalSize,
    jvModalDefaultSize: JV_MODAL_DEFAULT_SIZE,
    persistKey: JV_MODAL_PERSIST_KEY,
    minWidth: JV_MODAL_MIN_WIDTH,
    minHeight: JV_MODAL_MIN_HEIGHT,
  })

  return {
    jvModalOffset,
    setJvModalOffset,
    jvModalDrag,
    setJvModalDrag,
    jvModalSize,
    setJvModalSize,
    jvModalResize,
    setJvModalResize,
    beginJvModalDrag,
    beginJvModalResize,
    canCloseOnBackdropClick,
    jvModalDefaultSize: JV_MODAL_DEFAULT_SIZE,
  }
}

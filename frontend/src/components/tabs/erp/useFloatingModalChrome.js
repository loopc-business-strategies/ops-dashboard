import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import {
  ZERO_OFFSET,
  createDragState,
  createResizeState,
  projectDragOffset,
  projectResizeSize,
} from './modalGeometryUtils'

/**
 * Shared chrome for floating ERP popups: drag from header, resize from bottom-right.
 */
export function getFloatingModalDefaultSize({
  width = 720,
  heightRatio = 0.72,
  minHeight = 360,
  maxHeight = 1200,
} = {}) {
  if (typeof window === 'undefined') {
    return { width, height: Math.min(maxHeight, 640) }
  }
  const height = Math.max(
    minHeight,
    Math.min(maxHeight, Math.round(window.innerHeight * heightRatio)),
  )
  return { width: Math.min(width, window.innerWidth - 24), height }
}

export function getFloatingModalResizeBounds({
  minWidth = 420,
  minHeight = 280,
} = {}) {
  const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 24 : 2000
  const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 24 : 1200
  return { minWidth, minHeight, maxWidth, maxHeight }
}

export function useFloatingModalChrome({
  open,
  defaultWidth = 720,
  defaultHeightRatio = 0.72,
  minWidth = 420,
  minHeight = 280,
  maxHeight = 1200,
} = {}) {
  const panelRef = useRef(null)
  const dragSessionRef = useRef(null)
  const resizeSessionRef = useRef(null)
  const moveHandlerRef = useRef(null)
  const upHandlerRef = useRef(null)
  const suppressBackdropCloseRef = useRef(false)

  const getDefaultSize = useCallback(
    () => getFloatingModalDefaultSize({
      width: defaultWidth,
      heightRatio: defaultHeightRatio,
      minHeight,
      maxHeight,
    }),
    [defaultWidth, defaultHeightRatio, minHeight, maxHeight],
  )

  const [offset, setOffset] = useState(ZERO_OFFSET)
  const [size, setSize] = useState(getDefaultSize)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const cleanupListeners = useCallback(() => {
    if (moveHandlerRef.current) {
      window.removeEventListener('mousemove', moveHandlerRef.current)
      moveHandlerRef.current = null
    }
    if (upHandlerRef.current) {
      window.removeEventListener('mouseup', upHandlerRef.current)
      upHandlerRef.current = null
    }
    document.body.style.removeProperty('user-select')
  }, [])

  const stopInteraction = useCallback(() => {
    cleanupListeners()
    dragSessionRef.current = null
    resizeSessionRef.current = null
    setIsDragging(false)
    setIsResizing(false)
  }, [cleanupListeners])

  const finishInteraction = useCallback(() => {
    suppressBackdropCloseRef.current = true
    stopInteraction()
    setTimeout(() => {
      suppressBackdropCloseRef.current = false
    }, 0)
  }, [stopInteraction])

  const canCloseOnBackdropClick = useCallback(() => (
    !suppressBackdropCloseRef.current && !isDragging && !isResizing
  ), [isDragging, isResizing])

  useEffect(() => {
    if (open) return undefined
    setOffset(ZERO_OFFSET)
    setSize(getDefaultSize())
    suppressBackdropCloseRef.current = false
    stopInteraction()
    return undefined
  }, [open, getDefaultSize, stopInteraction])

  useEffect(() => {
    if (!open) return undefined
    setOffset(ZERO_OFFSET)
    setSize(getDefaultSize())
    return undefined
  }, [open, getDefaultSize])

  const beginDrag = useCallback((event) => {
    if (event.button !== 0) return
    if (event.target?.closest?.('button, a, input, select, textarea, label, [role="button"]')) return
    event.preventDefault()
    suppressBackdropCloseRef.current = true
    cleanupListeners()
    dragSessionRef.current = createDragState(event, offset)
    const onMove = (moveEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      setOffset(projectDragOffset(session, moveEvent))
    }
    const onUp = () => finishInteraction()
    moveHandlerRef.current = onMove
    upHandlerRef.current = onUp
    setIsDragging(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [offset, cleanupListeners, finishInteraction])

  const beginResize = useCallback((event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    suppressBackdropCloseRef.current = true
    cleanupListeners()
    resizeSessionRef.current = createResizeState(event, size)
    const bounds = getFloatingModalResizeBounds({ minWidth, minHeight })
    const onMove = (moveEvent) => {
      const session = resizeSessionRef.current
      if (!session) return
      setSize(projectResizeSize(session, moveEvent, bounds))
    }
    const onUp = () => finishInteraction()
    moveHandlerRef.current = onMove
    upHandlerRef.current = onUp
    setIsResizing(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size, minWidth, minHeight, cleanupListeners, finishInteraction])

  useEffect(() => () => cleanupListeners(), [cleanupListeners])

  return {
    panelRef,
    offset,
    size,
    isDragging,
    isResizing,
    beginDrag,
    beginResize,
    canCloseOnBackdropClick,
  }
}

/** Clearance so footer actions do not sit under the SE resize grip. */
export const FLOATING_MODAL_FOOTER_END_PAD = '1.85rem'

/** Subtle corner grip — low contrast so it does not clash with CTAs. */
export const FLOATING_MODAL_RESIZE_HANDLE_STYLE = {
  position: 'absolute',
  right: '3px',
  bottom: '3px',
  width: '12px',
  height: '12px',
  cursor: 'nwse-resize',
  zIndex: 1,
  opacity: 0.45,
  borderBottomRightRadius: '0.4rem',
  backgroundImage: [
    'linear-gradient(135deg, transparent 42%, #94A3B8 43%, #94A3B8 48%, transparent 49%)',
    'linear-gradient(135deg, transparent 58%, #94A3B8 59%, #94A3B8 64%, transparent 65%)',
    'linear-gradient(135deg, transparent 74%, #94A3B8 75%, #94A3B8 80%, transparent 81%)',
  ].join(', '),
  backgroundColor: 'transparent',
}

/** Bottom-right resize grip for floating ERP/voucher popups. */
export function FloatingModalResizeHandle({ onMouseDown }) {
  return createElement('div', {
    role: 'button',
    tabIndex: 0,
    onMouseDown,
    title: 'Resize',
    'aria-label': 'Resize',
    style: FLOATING_MODAL_RESIZE_HANDLE_STYLE,
  })
}

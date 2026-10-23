import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ZERO_OFFSET,
  createDragState,
  createResizeState,
  projectDragOffset,
  projectResizeSize,
} from '../erp/modalGeometryUtils'
import {
  resolveFloatingModalOpenSize,
  writePersistedFloatingModalSize,
} from '../erp/useFloatingModalChrome'

export function getDefaultModalHeight() {
  if (typeof window === 'undefined') return 792
  return Math.min(792, Math.round(window.innerHeight * 0.88))
}

export function getDefaultModalSize(wide = false) {
  return {
    width: wide ? 1100 : 720,
    height: getDefaultModalHeight(),
  }
}

export function getModalResizeBounds(wide = false) {
  const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 24 : 2000
  const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 24 : 1200
  return {
    minWidth: wide ? 860 : 520,
    minHeight: wide ? 500 : 400,
    maxWidth,
    maxHeight,
  }
}

export function useMasterSettingsModalChrome({ open, wide = false, persistKey = '' }) {
  const panelRef = useRef(null)
  const dragSessionRef = useRef(null)
  const resizeSessionRef = useRef(null)
  const moveHandlerRef = useRef(null)
  const upHandlerRef = useRef(null)
  const suppressBackdropCloseRef = useRef(false)
  const sizeRef = useRef(null)
  const persistKeyRef = useRef(persistKey)
  persistKeyRef.current = persistKey

  const bounds = getModalResizeBounds(wide)
  const resolveOpenSize = useCallback(
    () => resolveFloatingModalOpenSize({
      persistKey,
      getDefaultSize: () => getDefaultModalSize(wide),
      minWidth: bounds.minWidth,
      minHeight: bounds.minHeight,
      maxHeight: bounds.maxHeight,
    }),
    [persistKey, wide, bounds.minWidth, bounds.minHeight, bounds.maxHeight],
  )

  const [offset, setOffset] = useState(ZERO_OFFSET)
  const [size, setSize] = useState(resolveOpenSize)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  sizeRef.current = size

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
    suppressBackdropCloseRef.current = false
    stopInteraction()
    if (panelRef.current) {
      panelRef.current.style.transform = ''
      panelRef.current.style.willChange = ''
    }
    return undefined
  }, [open, stopInteraction])

  useEffect(() => {
    if (!open) return undefined
    setOffset(ZERO_OFFSET)
    setSize(resolveOpenSize())
    return undefined
  }, [open, resolveOpenSize])

  const beginDrag = useCallback((event) => {
    if (event.button !== 0) return
    if (event.target.closest('button')) return
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
    const resizeBounds = getModalResizeBounds(wide)
    const onMove = (moveEvent) => {
      const session = resizeSessionRef.current
      if (!session) return
      const next = projectResizeSize(session, moveEvent, resizeBounds)
      sizeRef.current = next
      setSize(next)
    }
    const onUp = () => {
      writePersistedFloatingModalSize(persistKeyRef.current, sizeRef.current)
      finishInteraction()
    }
    moveHandlerRef.current = onMove
    upHandlerRef.current = onUp
    setIsResizing(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size, wide, cleanupListeners, finishInteraction])

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

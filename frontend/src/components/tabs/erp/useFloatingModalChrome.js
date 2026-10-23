import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import {
  ZERO_OFFSET,
  createDragState,
  createResizeState,
  projectDragOffset,
  projectResizeSize,
} from './modalGeometryUtils'

/** localStorage prefix — bump version if the stored shape changes. */
export const FLOATING_MODAL_SIZE_STORAGE_PREFIX = 'ops.floatingModal.size.v1.'

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

export function clampFloatingModalSize(size, {
  minWidth = 420,
  minHeight = 280,
  maxHeight = 1200,
} = {}) {
  const bounds = getFloatingModalResizeBounds({ minWidth, minHeight })
  const cappedMaxHeight = Math.min(bounds.maxHeight, maxHeight)
  return {
    width: Math.round(Math.max(bounds.minWidth, Math.min(bounds.maxWidth, Number(size?.width) || 0))),
    height: Math.round(Math.max(bounds.minHeight, Math.min(cappedMaxHeight, Number(size?.height) || 0))),
  }
}

export function readPersistedFloatingModalSize(persistKey, fallback, clampOpts = {}) {
  if (!persistKey || typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`${FLOATING_MODAL_SIZE_STORAGE_PREFIX}${persistKey}`)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (!Number.isFinite(parsed?.width) || !Number.isFinite(parsed?.height)) return fallback
    if (parsed.width <= 0 || parsed.height <= 0) return fallback
    return clampFloatingModalSize(parsed, clampOpts)
  } catch {
    return fallback
  }
}

export function writePersistedFloatingModalSize(persistKey, size) {
  if (!persistKey || typeof window === 'undefined') return
  if (!Number.isFinite(size?.width) || !Number.isFinite(size?.height)) return
  try {
    window.localStorage.setItem(
      `${FLOATING_MODAL_SIZE_STORAGE_PREFIX}${persistKey}`,
      JSON.stringify({
        width: Math.round(size.width),
        height: Math.round(size.height),
      }),
    )
  } catch {
    // private mode / quota
  }
}

export function resolveFloatingModalOpenSize({
  persistKey,
  getDefaultSize,
  minWidth,
  minHeight,
  maxHeight,
}) {
  const fallback = typeof getDefaultSize === 'function' ? getDefaultSize() : getDefaultSize
  return readPersistedFloatingModalSize(persistKey, fallback, {
    minWidth,
    minHeight,
    maxHeight,
  })
}

export function useFloatingModalChrome({
  open,
  persistKey = '',
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
  const sizeRef = useRef(null)
  const persistKeyRef = useRef(persistKey)
  persistKeyRef.current = persistKey

  const getDefaultSize = useCallback(
    () => getFloatingModalDefaultSize({
      width: defaultWidth,
      heightRatio: defaultHeightRatio,
      minHeight,
      maxHeight,
    }),
    [defaultWidth, defaultHeightRatio, minHeight, maxHeight],
  )

  const resolveOpenSize = useCallback(
    () => resolveFloatingModalOpenSize({
      persistKey,
      getDefaultSize,
      minWidth,
      minHeight,
      maxHeight,
    }),
    [persistKey, getDefaultSize, minWidth, minHeight, maxHeight],
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
      const next = projectResizeSize(session, moveEvent, bounds)
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

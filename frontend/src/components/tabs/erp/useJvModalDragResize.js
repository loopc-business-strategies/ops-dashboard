import { useCallback, useEffect, useRef } from 'react'
import {
  resolveFloatingModalOpenSize,
  writePersistedFloatingModalSize,
} from './useFloatingModalChrome'

/** JV modal drag + resize while the ledger voucher form is open. */
export function useJvModalDragResize({
  showLedgerForm,
  jvModalDrag,
  setJvModalDrag,
  jvModalOffset,
  setJvModalOffset,
  jvModalResize,
  setJvModalResize,
  jvModalSize,
  setJvModalSize,
  jvModalDefaultSize,
  persistKey = '',
  minWidth = 860,
  minHeight = 500,
}) {
  const suppressBackdropCloseRef = useRef(false)
  const sizeRef = useRef(jvModalSize)
  sizeRef.current = jvModalSize
  const persistKeyRef = useRef(persistKey)
  persistKeyRef.current = persistKey

  const finishInteraction = useCallback((setActive) => {
    suppressBackdropCloseRef.current = true
    setActive()
    setTimeout(() => {
      suppressBackdropCloseRef.current = false
    }, 0)
  }, [])

  const canCloseOnBackdropClick = useCallback(() => (
    !suppressBackdropCloseRef.current && !jvModalDrag.active && !jvModalResize.active
  ), [jvModalDrag.active, jvModalResize.active])

  const beginJvModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    suppressBackdropCloseRef.current = true
    setJvModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: jvModalOffset.x,
      startY: jvModalOffset.y,
    })
  }

  const beginJvModalResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    suppressBackdropCloseRef.current = true
    setJvModalResize({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startW: jvModalSize.width,
      startH: jvModalSize.height,
    })
  }

  useEffect(() => {
    if (!showLedgerForm) {
      suppressBackdropCloseRef.current = false
      setJvModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setJvModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      setJvModalResize((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0) return prev
        return {
          active: false,
          pointerX: 0,
          pointerY: 0,
          startW: sizeRef.current.width,
          startH: sizeRef.current.height,
        }
      })
      return undefined
    }
    setJvModalSize((prev) => {
      const next = resolveFloatingModalOpenSize({
        persistKey: persistKeyRef.current,
        getDefaultSize: () => jvModalDefaultSize,
        minWidth,
        minHeight,
      })
      if (prev.width === next.width && prev.height === next.height) return prev
      return next
    })
    return undefined
  }, [showLedgerForm, jvModalDefaultSize, minWidth, minHeight, setJvModalDrag, setJvModalOffset, setJvModalResize, setJvModalSize])

  useEffect(() => {
    if (!showLedgerForm || !jvModalDrag.active) return undefined
    const onMouseMove = (event) => {
      setJvModalOffset({
        x: jvModalDrag.startX + (event.clientX - jvModalDrag.pointerX),
        y: jvModalDrag.startY + (event.clientY - jvModalDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      finishInteraction(() => {
        setJvModalDrag((prev) => ({ ...prev, active: false }))
      })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalDrag, setJvModalDrag, setJvModalOffset, finishInteraction])

  useEffect(() => {
    if (!showLedgerForm || !jvModalResize.active) return undefined
    const onMouseMove = (event) => {
      const next = {
        width: Math.max(minWidth, Math.min(window.innerWidth - 24, jvModalResize.startW + (event.clientX - jvModalResize.pointerX))),
        height: Math.max(minHeight, Math.min(window.innerHeight - 24, jvModalResize.startH + (event.clientY - jvModalResize.pointerY))),
      }
      sizeRef.current = next
      setJvModalSize(next)
    }
    const onMouseUp = () => {
      writePersistedFloatingModalSize(persistKeyRef.current, sizeRef.current)
      finishInteraction(() => {
        setJvModalResize((prev) => ({ ...prev, active: false }))
      })
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalResize, minWidth, minHeight, setJvModalResize, setJvModalSize, finishInteraction])

  return { beginJvModalDrag, beginJvModalResize, canCloseOnBackdropClick }
}

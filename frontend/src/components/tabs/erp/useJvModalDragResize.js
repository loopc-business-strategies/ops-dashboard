import { useEffect } from 'react'

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
}) {
  const beginJvModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
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
      setJvModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setJvModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      setJvModalResize((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startW === jvModalDefaultSize.width && prev.startH === jvModalDefaultSize.height) return prev
        return { active: false, pointerX: 0, pointerY: 0, startW: jvModalDefaultSize.width, startH: jvModalDefaultSize.height }
      })
      setJvModalSize((prev) => (prev.width === jvModalDefaultSize.width && prev.height === jvModalDefaultSize.height ? prev : jvModalDefaultSize))
      return undefined
    }
    if (!jvModalDrag.active) return undefined
    const onMouseMove = (event) => {
      setJvModalOffset({
        x: jvModalDrag.startX + (event.clientX - jvModalDrag.pointerX),
        y: jvModalDrag.startY + (event.clientY - jvModalDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setJvModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalDrag, jvModalDefaultSize, setJvModalDrag, setJvModalOffset, setJvModalResize, setJvModalSize])

  useEffect(() => {
    if (!showLedgerForm || !jvModalResize.active) return undefined
    const onMouseMove = (event) => {
      const nextWidth = Math.max(860, Math.min(window.innerWidth - 24, jvModalResize.startW + (event.clientX - jvModalResize.pointerX)))
      const nextHeight = Math.max(500, Math.min(window.innerHeight - 24, jvModalResize.startH + (event.clientY - jvModalResize.pointerY)))
      setJvModalSize({ width: nextWidth, height: nextHeight })
    }
    const onMouseUp = () => {
      setJvModalResize((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalResize, setJvModalResize, setJvModalSize])

  return { beginJvModalDrag, beginJvModalResize }
}

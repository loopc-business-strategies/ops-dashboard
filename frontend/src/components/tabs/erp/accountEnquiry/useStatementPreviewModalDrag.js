import { useEffect, useState } from 'react'

/**
 * Draggable offset state for the statement preview modal.
 */
export function useStatementPreviewModalDrag(showStatementPreview) {
  const [statementPreviewOffset, setStatementPreviewOffset] = useState({ x: 0, y: 0 })
  const [statementPreviewDrag, setStatementPreviewDrag] = useState({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
  })

  const statementPreviewBackdropColor = statementPreviewDrag.active
    ? 'rgba(15, 23, 42, 0.12)'
    : 'rgba(15, 23, 42, 0.45)'

  const beginStatementPreviewDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setStatementPreviewDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: statementPreviewOffset.x,
      startY: statementPreviewOffset.y,
    })
  }

  useEffect(() => {
    if (!showStatementPreview) {
      setStatementPreviewOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setStatementPreviewDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!statementPreviewDrag.active) return undefined
    const handlePointerMove = (event) => {
      setStatementPreviewOffset({
        x: statementPreviewDrag.startX + (event.clientX - statementPreviewDrag.pointerX),
        y: statementPreviewDrag.startY + (event.clientY - statementPreviewDrag.pointerY),
      })
    }
    const handlePointerUp = () => {
      setStatementPreviewDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [showStatementPreview, statementPreviewDrag])

  return {
    statementPreviewOffset,
    statementPreviewDrag,
    beginStatementPreviewDrag,
    statementPreviewBackdropColor,
  }
}

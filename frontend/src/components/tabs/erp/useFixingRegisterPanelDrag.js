import { useEffect } from 'react'

/** Draggable fixing-register filter panel offset while on the fixing-register tab. */
export function useFixingRegisterPanelDrag({
  activeTab,
  fixingRegPanelOffset,
  fixingRegPanelDrag,
  setFixingRegPanelDrag,
  setFixingRegPanelOffset,
}) {
  const beginFixingRegPanelDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setFixingRegPanelDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: fixingRegPanelOffset.x,
      startY: fixingRegPanelOffset.y,
    })
  }

  useEffect(() => {
    if (activeTab !== 'fixing-register') {
      setFixingRegPanelOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setFixingRegPanelDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!fixingRegPanelDrag.active) return undefined
    const onMouseMove = (event) => {
      setFixingRegPanelOffset({
        x: fixingRegPanelDrag.startX + (event.clientX - fixingRegPanelDrag.pointerX),
        y: fixingRegPanelDrag.startY + (event.clientY - fixingRegPanelDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setFixingRegPanelDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTab, fixingRegPanelDrag, setFixingRegPanelDrag, setFixingRegPanelOffset])

  return { beginFixingRegPanelDrag }
}

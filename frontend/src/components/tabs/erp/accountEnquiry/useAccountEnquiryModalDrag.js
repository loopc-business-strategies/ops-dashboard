import { useEffect, useState } from 'react'

/**
 * Draggable offset state for the account enquiry modal.
 */
export function useAccountEnquiryModalDrag(showEnquiryModal) {
  const [enquiryModalOffset, setEnquiryModalOffset] = useState({ x: 0, y: 0 })
  const [enquiryModalDrag, setEnquiryModalDrag] = useState({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
  })

  const enquiryBackdropColor = enquiryModalDrag.active
    ? 'rgba(15, 23, 42, 0.12)'
    : 'rgba(15, 23, 42, 0.45)'

  const beginEnquiryModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setEnquiryModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: enquiryModalOffset.x,
      startY: enquiryModalOffset.y,
    })
  }

  useEffect(() => {
    if (!showEnquiryModal) {
      setEnquiryModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setEnquiryModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!enquiryModalDrag.active) return undefined
    const handlePointerMove = (event) => {
      setEnquiryModalOffset({
        x: enquiryModalDrag.startX + (event.clientX - enquiryModalDrag.pointerX),
        y: enquiryModalDrag.startY + (event.clientY - enquiryModalDrag.pointerY),
      })
    }
    const handlePointerUp = () => {
      setEnquiryModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [showEnquiryModal, enquiryModalDrag])

  return {
    enquiryModalOffset,
    enquiryModalDrag,
    beginEnquiryModalDrag,
    enquiryBackdropColor,
  }
}

/**
 * Window-level pointer drag for floating modals (inventory mapping / product modals).
 * Centralizes add/remove of mousemove + mouseup listeners.
 */

/**
 * @param {React.MutableRefObject<{ moveHandler: ((e: MouseEvent) => void) | null, upHandler: (() => void) | null }>} dragRef
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setDragging
 */
export function stopWindowDrag(dragRef, setDragging) {
  const { moveHandler, upHandler } = dragRef.current || {}
  if (moveHandler) window.removeEventListener('mousemove', moveHandler)
  if (upHandler) window.removeEventListener('mouseup', upHandler)
  dragRef.current = { moveHandler: null, upHandler: null }
  setDragging(false)
}

/**
 * @param {MouseEvent} event
 * @param {{ x: number, y: number }} originOffset
 * @param {(next: { x: number, y: number }) => void} setOffset
 * @param {React.MutableRefObject<{ moveHandler: ((e: MouseEvent) => void) | null, upHandler: (() => void) | null }>} dragRef
 * @param {React.Dispatch<React.SetStateAction<boolean>>} setDragging
 */
export function startWindowDrag(event, originOffset, setOffset, dragRef, setDragging) {
  if (event.button !== 0) return
  event.preventDefault()
  const startX = event.clientX
  const startY = event.clientY
  const originX = originOffset.x
  const originY = originOffset.y
  const moveHandler = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY
    setOffset({ x: originX + deltaX, y: originY + deltaY })
  }
  const upHandler = () => {
    stopWindowDrag(dragRef, setDragging)
  }
  stopWindowDrag(dragRef, setDragging)
  setDragging(true)
  dragRef.current = { moveHandler, upHandler }
  window.addEventListener('mousemove', moveHandler)
  window.addEventListener('mouseup', upHandler)
}

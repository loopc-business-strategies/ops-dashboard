const ZERO_OFFSET = { x: 0, y: 0 }

const createDragState = (event, origin = ZERO_OFFSET) => ({
  active: true,
  pointerX: event.clientX,
  pointerY: event.clientY,
  startX: Number(origin.x || 0),
  startY: Number(origin.y || 0),
})

const createResizeState = (event, size = {}) => ({
  active: true,
  pointerX: event.clientX,
  pointerY: event.clientY,
  startW: Number(size.width || 0),
  startH: Number(size.height || 0),
})

const resetDragState = () => ({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })

const resetResizeState = (size = {}) => ({
  active: false,
  pointerX: 0,
  pointerY: 0,
  startW: Number(size.width || 0),
  startH: Number(size.height || 0),
})

const isResetDragState = (state = {}) => (
  !state.active
  && Number(state.pointerX || 0) === 0
  && Number(state.pointerY || 0) === 0
  && Number(state.startX || 0) === 0
  && Number(state.startY || 0) === 0
)

const isResetResizeState = (state = {}, size = {}) => (
  !state.active
  && Number(state.pointerX || 0) === 0
  && Number(state.pointerY || 0) === 0
  && Number(state.startW || 0) === Number(size.width || 0)
  && Number(state.startH || 0) === Number(size.height || 0)
)

const projectDragOffset = (dragState = {}, event) => ({
  x: Number(dragState.startX || 0) + (event.clientX - Number(dragState.pointerX || 0)),
  y: Number(dragState.startY || 0) + (event.clientY - Number(dragState.pointerY || 0)),
})

const projectResizeSize = (resizeState = {}, event, bounds = {}) => {
  const minWidth = Number(bounds.minWidth || 0)
  const minHeight = Number(bounds.minHeight || 0)
  const maxWidth = Number.isFinite(bounds.maxWidth) ? bounds.maxWidth : Infinity
  const maxHeight = Number.isFinite(bounds.maxHeight) ? bounds.maxHeight : Infinity
  const width = Number(resizeState.startW || 0) + (event.clientX - Number(resizeState.pointerX || 0))
  const height = Number(resizeState.startH || 0) + (event.clientY - Number(resizeState.pointerY || 0))
  return {
    width: Math.max(minWidth, Math.min(maxWidth, width)),
    height: Math.max(minHeight, Math.min(maxHeight, height)),
  }
}

export {
  ZERO_OFFSET,
  createDragState,
  createResizeState,
  isResetDragState,
  isResetResizeState,
  projectDragOffset,
  projectResizeSize,
  resetDragState,
  resetResizeState,
}

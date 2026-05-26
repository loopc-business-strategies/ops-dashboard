import { describe, expect, it } from 'vitest'
import {
  createDragState,
  createResizeState,
  isResetDragState,
  isResetResizeState,
  projectDragOffset,
  projectResizeSize,
  resetDragState,
  resetResizeState,
} from './modalGeometryUtils'

describe('modalGeometryUtils', () => {
  it('creates and resets drag state', () => {
    const state = createDragState({ clientX: 20, clientY: 30 }, { x: 5, y: 8 })

    expect(state).toEqual({ active: true, pointerX: 20, pointerY: 30, startX: 5, startY: 8 })
    expect(isResetDragState(state)).toBe(false)
    expect(isResetDragState(resetDragState())).toBe(true)
  })

  it('projects drag offsets from the original pointer and origin', () => {
    const state = createDragState({ clientX: 20, clientY: 30 }, { x: 5, y: 8 })

    expect(projectDragOffset(state, { clientX: 27, clientY: 21 })).toEqual({ x: 12, y: -1 })
  })

  it('creates and resets resize state', () => {
    const state = createResizeState({ clientX: 10, clientY: 15 }, { width: 500, height: 300 })

    expect(state).toEqual({ active: true, pointerX: 10, pointerY: 15, startW: 500, startH: 300 })
    expect(isResetResizeState(state, { width: 500, height: 300 })).toBe(false)
    expect(isResetResizeState(resetResizeState({ width: 500, height: 300 }), { width: 500, height: 300 })).toBe(true)
  })

  it('projects resize dimensions with min and max bounds', () => {
    const state = createResizeState({ clientX: 10, clientY: 10 }, { width: 500, height: 300 })

    expect(projectResizeSize(state, { clientX: 60, clientY: 80 }, { minWidth: 380, minHeight: 250, maxWidth: 520, maxHeight: 360 })).toEqual({
      width: 520,
      height: 360,
    })
    expect(projectResizeSize(state, { clientX: -500, clientY: -500 }, { minWidth: 380, minHeight: 250 })).toEqual({
      width: 380,
      height: 250,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { projectResizeSize, createResizeState } from '../erp/modalGeometryUtils'
import {
  getDefaultModalSize,
  getModalResizeBounds,
} from './useMasterSettingsModalChrome'

describe('useMasterSettingsModalChrome helpers', () => {
  it('uses wider default size for wide modals', () => {
    expect(getDefaultModalSize(true).width).toBe(1100)
    expect(getDefaultModalSize(false).width).toBe(720)
  })

  it('applies wider minimum bounds for wide modals', () => {
    const wideBounds = getModalResizeBounds(true)
    const narrowBounds = getModalResizeBounds(false)
    expect(wideBounds.minWidth).toBe(860)
    expect(narrowBounds.minWidth).toBe(520)
    expect(wideBounds.minHeight).toBe(500)
    expect(narrowBounds.minHeight).toBe(400)
  })

  it('clamps resize dimensions to modal bounds', () => {
    const state = createResizeState({ clientX: 100, clientY: 100 }, { width: 720, height: 600 })
    const bounds = getModalResizeBounds(false)
    const shrunk = projectResizeSize(state, { clientX: -500, clientY: -500 }, bounds)
    expect(shrunk.width).toBe(bounds.minWidth)
    expect(shrunk.height).toBe(bounds.minHeight)
  })
})

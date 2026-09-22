import { describe, expect, it } from 'vitest'
import { getTenant } from './tenant'

describe('mg-factory tenant lock', () => {
  it('is permanently mg', () => {
    expect(getTenant()).toBe('mg')
  })
})

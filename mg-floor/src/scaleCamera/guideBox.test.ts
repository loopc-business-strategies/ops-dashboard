import { describe, expect, it } from 'vitest'
import { guideBoxForPreview, mapGuideBoxToPhotoCrop, pickPictureSize } from './guideBox'

describe('mapGuideBoxToPhotoCrop', () => {
  it('maps directly when aspect ratios match', () => {
    const crop = mapGuideBoxToPhotoCrop({ x: 100, y: 50, width: 200, height: 100 }, { width: 400, height: 200 }, { width: 1600, height: 800 })
    expect(crop.x).toBeCloseTo(0.25)
    expect(crop.y).toBeCloseTo(0.25)
    expect(crop.width).toBeCloseTo(0.5)
    expect(crop.height).toBeCloseTo(0.5)
  })

  it('accounts for cover cropping of a taller photo', () => {
    // Photo 4:3 shown in a 16:9 view → top and bottom of the photo are hidden.
    const preview = { width: 1600, height: 900 }
    const photo = { width: 1600, height: 1200 }
    const crop = mapGuideBoxToPhotoCrop({ x: 0, y: 0, width: 1600, height: 900 }, preview, photo)
    expect(crop.x).toBeCloseTo(0)
    expect(crop.width).toBeCloseTo(1)
    expect(crop.y).toBeCloseTo(150 / 1200)
    expect(crop.height).toBeCloseTo(900 / 1200)
  })

  it('swaps photo axes when orientation differs from the preview', () => {
    const crop = mapGuideBoxToPhotoCrop({ x: 0, y: 0, width: 400, height: 200 }, { width: 400, height: 200 }, { width: 800, height: 1600 })
    expect(crop.width).toBeCloseTo(1)
    expect(crop.height).toBeCloseTo(1)
  })

  it('guide box is centered inside the preview', () => {
    const g = guideBoxForPreview({ width: 1000, height: 600 })
    expect(g.x + g.width / 2).toBeCloseTo(500)
    expect(g.y + g.height / 2).toBeCloseTo(300)
  })

  it('guide box follows per-scale width and aspect', () => {
    const g = guideBoxForPreview({ width: 1000, height: 600 }, { width: 0.8, aspect: 4 })
    expect(g.width).toBeCloseTo(800)
    expect(g.height).toBeCloseTo(200)
    expect(g.x).toBeCloseTo(100)
  })
})

describe('pickPictureSize', () => {
  it('picks the largest size not above the target', () => {
    expect(pickPictureSize(['4000x3000', '1920x1080', '1280x720', '640x480'])).toBe('1920x1080')
    expect(pickPictureSize(['4000x3000', '3264x2448'])).toBe('3264x2448')
    expect(pickPictureSize(['Photo', 'High'])).toBeUndefined()
  })
})

export type Size = { width: number; height: number }
export type Rect = { x: number; y: number; width: number; height: number }

export type GuideBoxFraction = { width: number; aspect: number }

/** Guide box as a fraction of the preview — a wide landscape window matching the GJ display. */
export const GUIDE_BOX_FRACTION: GuideBoxFraction = { width: 0.72, aspect: 3.2 }

export function guideBoxForPreview(preview: Size, fraction: GuideBoxFraction = GUIDE_BOX_FRACTION): Rect {
  const width = preview.width * fraction.width
  const height = Math.min(preview.height * 0.6, width / fraction.aspect)
  return {
    x: (preview.width - width) / 2,
    y: (preview.height - height) / 2,
    width,
    height,
  }
}

/**
 * Map the on-screen guide box to a crop normalized to the captured photo. The preview shows the
 * sensor image scaled to cover the view (centered, overflow clipped), so the mapping undoes that
 * scale and offset. If the photo orientation differs from the preview's, its axes are swapped.
 */
export function mapGuideBoxToPhotoCrop(guide: Rect, preview: Size, photo: Size): Rect {
  const previewLandscape = preview.width >= preview.height
  const photoLandscape = photo.width >= photo.height
  const pw = previewLandscape === photoLandscape ? photo.width : photo.height
  const ph = previewLandscape === photoLandscape ? photo.height : photo.width

  const scale = Math.max(preview.width / pw, preview.height / ph)
  const offsetX = (pw * scale - preview.width) / 2
  const offsetY = (ph * scale - preview.height) / 2

  const x0 = (guide.x + offsetX) / scale / pw
  const y0 = (guide.y + offsetY) / scale / ph
  const x1 = (guide.x + guide.width + offsetX) / scale / pw
  const y1 = (guide.y + guide.height + offsetY) / scale / ph

  const cx0 = Math.min(1, Math.max(0, x0))
  const cy0 = Math.min(1, Math.max(0, y0))
  const cx1 = Math.min(1, Math.max(cx0, x1))
  const cy1 = Math.min(1, Math.max(cy0, y1))
  return { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0 }
}

/** Pick a picture size near the target width (smaller frames keep OCR fast and memory low). */
export function pickPictureSize(sizes: string[], targetWidth = 1920): string | undefined {
  const parsed = sizes
    .map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(s.trim())
      return m ? { s, w: Math.max(Number(m[1]), Number(m[2])) } : null
    })
    .filter((v): v is { s: string; w: number } => !!v)
  if (!parsed.length) return undefined
  const atMost = parsed.filter((p) => p.w <= targetWidth).sort((a, b) => b.w - a.w)
  if (atMost.length) return atMost[0].s
  return parsed.sort((a, b) => a.w - b.w)[0].s
}

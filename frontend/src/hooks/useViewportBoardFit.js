import { useLayoutEffect } from 'react'

/**
 * Uniform scale so a design board (default 1920×1080) fills the real viewport.
 * Uses CSS zoom when available (Chromium / TV browsers) with matching width/height
 * compensation so both axes fill — fixing the old height-only zoom that left
 * side gaps or clipped edges on 4K / ultrawide TVs.
 */

export function computeViewportBoardFit({
  viewportWidth,
  viewportHeight,
  designWidth = 1920,
  designHeight = 1080,
  minScale = 0.35,
  maxScale = 4,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1)
  const vh = Math.max(1, Number(viewportHeight) || 1)
  const dw = Math.max(1, Number(designWidth) || 1920)
  const dh = Math.max(1, Number(designHeight) || 1080)
  const raw = Math.min(vw / dw, vh / dh)
  const scale = Math.min(maxScale, Math.max(minScale, raw))
  return {
    scale,
    layoutWidth: vw / scale,
    layoutHeight: vh / scale,
  }
}

function readViewportSize() {
  const vv = window.visualViewport
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height }
  }
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 1920,
    height: window.innerHeight || document.documentElement.clientHeight || 1080,
  }
}

function supportsCssZoom() {
  try {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1')
  } catch {
    return false
  }
}

function clearFitStyles(el) {
  el.style.zoom = ''
  el.style.width = ''
  el.style.height = ''
  el.style.transform = ''
  el.style.transformOrigin = ''
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
}

/**
 * @param {React.RefObject<HTMLElement|null>} ref
 * @param {{ designWidth?: number, designHeight?: number, enabled?: boolean, minViewportWidth?: number }} [options]
 */
export function useViewportBoardFit(ref, options = {}) {
  const {
    designWidth = 1920,
    designHeight = 1080,
    enabled = true,
    /** Below this CSS px width, skip scaling (phones / small tablets keep native layout). */
    minViewportWidth = 1024,
  } = options

  useLayoutEffect(() => {
    const el = ref?.current
    if (!el || !enabled) {
      if (el) {
        clearFitStyles(el)
        el.removeAttribute('data-viewport-fit')
      }
      return undefined
    }

    const useZoom = supportsCssZoom()
    let raf = 0

    const apply = () => {
      const { width: vw, height: vh } = readViewportSize()

      // Phones / narrow windows: native responsive CSS, no board scale.
      if (vw < minViewportWidth) {
        clearFitStyles(el)
        el.removeAttribute('data-viewport-fit')
        return
      }

      const { scale, layoutWidth, layoutHeight } = computeViewportBoardFit({
        viewportWidth: vw,
        viewportHeight: vh,
        designWidth,
        designHeight,
      })

      el.setAttribute('data-viewport-fit', useZoom ? 'zoom' : 'transform')
      el.style.width = `${layoutWidth}px`
      el.style.height = `${layoutHeight}px`

      if (useZoom) {
        el.style.zoom = String(scale)
        el.style.transform = ''
        el.style.transformOrigin = ''
        el.style.position = ''
        el.style.left = ''
        el.style.top = ''
      } else {
        el.style.zoom = ''
        el.style.position = 'absolute'
        el.style.left = '0'
        el.style.top = '0'
        el.style.transformOrigin = 'top left'
        el.style.transform = `scale(${scale})`
      }
    }

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        apply()
      })
    }

    apply()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    const vv = window.visualViewport
    vv?.addEventListener?.('resize', schedule)
    vv?.addEventListener?.('scroll', schedule)

    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      vv?.removeEventListener?.('resize', schedule)
      vv?.removeEventListener?.('scroll', schedule)
      clearFitStyles(el)
      el.removeAttribute('data-viewport-fit')
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [ref, designWidth, designHeight, enabled, minViewportWidth])
}

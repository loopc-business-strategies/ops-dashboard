import { useLayoutEffect } from 'react'

/**
 * Scale a fixed 1920×1080 board to the real viewport.
 *
 * Always uses transform: scale() (not CSS zoom). Smart-TV / TCL browsers often
 * report CSS.supports('zoom') but do not apply zoom — that left the UI stuck
 * top-left with a large empty band on the right.
 *
 * mode "fill" (default): stretch both axes so the board covers the TV exactly.
 * mode "contain": uniform scale, letterboxed inside the shell.
 */

export function computeViewportBoardFit({
  viewportWidth,
  viewportHeight,
  designWidth = 1920,
  designHeight = 1080,
  mode = 'fill',
  minScale = 0.25,
  maxScale = 6,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1)
  const vh = Math.max(1, Number(viewportHeight) || 1)
  const dw = Math.max(1, Number(designWidth) || 1920)
  const dh = Math.max(1, Number(designHeight) || 1080)
  const clamp = (n) => Math.min(maxScale, Math.max(minScale, n))

  if (mode === 'contain') {
    const scale = clamp(Math.min(vw / dw, vh / dh))
    return {
      mode: 'contain',
      scaleX: scale,
      scaleY: scale,
      layoutWidth: dw,
      layoutHeight: dh,
      offsetLeft: (vw - dw * scale) / 2,
      offsetTop: (vh - dh * scale) / 2,
    }
  }

  return {
    mode: 'fill',
    scaleX: clamp(vw / dw),
    scaleY: clamp(vh / dh),
    layoutWidth: dw,
    layoutHeight: dh,
    offsetLeft: 0,
    offsetTop: 0,
  }
}

function readViewportSize() {
  const vv = window.visualViewport
  const innerW = window.innerWidth || document.documentElement.clientWidth || 0
  const innerH = window.innerHeight || document.documentElement.clientHeight || 0
  const vvW = vv && vv.width > 0 ? vv.width : 0
  const vvH = vv && vv.height > 0 ? vv.height : 0
  // Prefer the larger measurement — some TV browsers under-report innerWidth.
  const screenW = Number(window.screen?.availWidth || window.screen?.width || 0)
  const screenH = Number(window.screen?.availHeight || window.screen?.height || 0)
  return {
    width: Math.max(innerW, vvW, screenW > innerW * 1.2 ? screenW : 0, 1),
    height: Math.max(innerH, vvH, screenH > innerH * 1.2 ? screenH : 0, 1),
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
  el.style.right = ''
  el.style.bottom = ''
  el.style.maxWidth = ''
  el.style.maxHeight = ''
}

/**
 * @param {React.RefObject<HTMLElement|null>} ref
 * @param {{
 *   designWidth?: number,
 *   designHeight?: number,
 *   enabled?: boolean,
 *   minViewportWidth?: number,
 *   mode?: 'fill' | 'contain',
 * }} [options]
 */
export function useViewportBoardFit(ref, options = {}) {
  const {
    designWidth = 1920,
    designHeight = 1080,
    enabled = true,
    /** TV browsers sometimes report ~960 CSS px; keep threshold low. */
    minViewportWidth = 800,
    mode = 'fill',
  } = options

  useLayoutEffect(() => {
    const el = ref?.current
    if (!el || !enabled) {
      if (el) {
        clearFitStyles(el)
        el.removeAttribute('data-viewport-fit')
      }
      document.documentElement.removeAttribute('data-tv-board-fit')
      return undefined
    }

    let raf = 0

    const apply = () => {
      const { width: vw, height: vh } = readViewportSize()

      if (vw < minViewportWidth) {
        clearFitStyles(el)
        el.removeAttribute('data-viewport-fit')
        document.documentElement.removeAttribute('data-tv-board-fit')
        return
      }

      const fit = computeViewportBoardFit({
        viewportWidth: vw,
        viewportHeight: vh,
        designWidth,
        designHeight,
        mode,
      })

      el.setAttribute('data-viewport-fit', fit.mode)
      document.documentElement.setAttribute('data-tv-board-fit', fit.mode)

      el.style.zoom = ''
      el.style.position = 'absolute'
      el.style.left = `${fit.offsetLeft}px`
      el.style.top = `${fit.offsetTop}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.width = `${fit.layoutWidth}px`
      el.style.height = `${fit.layoutHeight}px`
      el.style.maxWidth = 'none'
      el.style.maxHeight = 'none'
      el.style.transformOrigin = 'top left'
      el.style.transform = `scale(${fit.scaleX}, ${fit.scaleY})`
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
      document.documentElement.removeAttribute('data-tv-board-fit')
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [ref, designWidth, designHeight, enabled, minViewportWidth, mode])
}

import { useLayoutEffect } from 'react'

/**
 * Scale a fixed 1920×1080 board to the real viewport.
 *
 * Always uses transform: scale() (not CSS zoom). Smart-TV / TCL browsers often
 * report CSS.supports('zoom') but do not apply zoom — that left the UI stuck
 * top-left with a large empty band on the right.
 *
 * mode "fill" (default): stretch both axes so the board covers the TV.
 * mode "contain": uniform scale, letterboxed inside the shell.
 *
 * safeInset (0–0.12): shrink + center the scaled board so TV overscan does not
 * clip the header/edges (typical wall TVs crop ~2–4%).
 *
 * After apply, verifies getBoundingClientRect(); if transform did not fill the
 * host, falls back to absolute stretch (width/height 100%).
 */

export function computeViewportBoardFit({
  viewportWidth,
  viewportHeight,
  designWidth = 1920,
  designHeight = 1080,
  mode = 'fill',
  minScale = 0.25,
  maxScale = 6,
  safeInset = 0,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1)
  const vh = Math.max(1, Number(viewportHeight) || 1)
  const dw = Math.max(1, Number(designWidth) || 1920)
  const dh = Math.max(1, Number(designHeight) || 1080)
  const inset = Math.min(0.12, Math.max(0, Number(safeInset) || 0))
  const usableW = vw * (1 - inset)
  const usableH = vh * (1 - inset)
  const clamp = (n) => Math.min(maxScale, Math.max(minScale, n))

  if (mode === 'contain') {
    const scale = clamp(Math.min(usableW / dw, usableH / dh))
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

  const scaleX = clamp(usableW / dw)
  const scaleY = clamp(usableH / dh)
  return {
    mode: 'fill',
    scaleX,
    scaleY,
    layoutWidth: dw,
    layoutHeight: dh,
    offsetLeft: (vw - dw * scaleX) / 2,
    offsetTop: (vh - dh * scaleY) / 2,
  }
}

/** @returns {{ width: number, height: number }} */
export function readViewportSize(hostEl) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const innerW = window.innerWidth || document.documentElement.clientWidth || 0
  const innerH = window.innerHeight || document.documentElement.clientHeight || 0
  const clientW = document.documentElement.clientWidth || 0
  const clientH = document.documentElement.clientHeight || 0
  const outerW = window.outerWidth || 0
  const outerH = window.outerHeight || 0
  const vvW = vv && vv.width > 0 ? vv.width : 0
  const vvH = vv && vv.height > 0 ? vv.height : 0
  const screenW = Number(window.screen?.availWidth || window.screen?.width || 0)
  const screenH = Number(window.screen?.availHeight || window.screen?.height || 0)

  let hostW = 0
  let hostH = 0
  const parent = hostEl?.parentElement
  if (parent) {
    hostW = parent.clientWidth || 0
    hostH = parent.clientHeight || 0
    try {
      const rect = parent.getBoundingClientRect()
      if (rect.width > hostW) hostW = rect.width
      if (rect.height > hostH) hostH = rect.height
    } catch {
      /* ignore */
    }
  }

  let width = Math.max(hostW, innerW, clientW, vvW, 1)
  let height = Math.max(hostH, innerH, clientH, vvH, 1)

  if (outerW > width && outerW < 5000) width = outerW
  if (outerH > height && outerH < 5000) height = outerH

  // Promote screen size only when CSS viewport looks like a half-scale under-report
  // of a Full-HD/4K 16:9 panel (common on some TCL / smart-TV browsers).
  const screenLooksTv = screenW >= 1280 && screenH >= 720
    && Math.abs(screenW / screenH - 16 / 9) < 0.2
  if (screenLooksTv && width > 0 && width <= screenW * 0.6) {
    width = screenW
  }
  if (screenLooksTv && height > 0 && height <= screenH * 0.6) {
    height = screenH
  }

  return { width, height }
}

export function shouldEnableBoardFit(viewportWidth, viewportHeight, screenSize) {
  const vw = Number(viewportWidth) || 0
  const vh = Number(viewportHeight) || 0
  const fromWin = typeof window !== 'undefined'
    ? {
      w: Number(window.screen?.width || window.screen?.availWidth || 0),
      h: Number(window.screen?.height || window.screen?.availHeight || 0),
    }
    : { w: 0, h: 0 }
  const screenW = Number(screenSize?.width ?? fromWin.w) || 0
  const screenH = Number(screenSize?.height ?? fromWin.h) || 0
  if (screenW >= 1280 || screenH >= 720) return true
  if (vw >= 800 && vw / Math.max(vh, 1) >= 1.15) return true
  return vw >= 900
}

function clearFitStyles(el) {
  el.style.zoom = ''
  el.style.width = ''
  el.style.height = ''
  el.style.transform = ''
  el.style.webkitTransform = ''
  el.style.transformOrigin = ''
  el.style.webkitTransformOrigin = ''
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
  el.style.right = ''
  el.style.bottom = ''
  el.style.maxWidth = ''
  el.style.maxHeight = ''
  el.style.minWidth = ''
  el.style.minHeight = ''
}

function applyStretchFallback(el, safeInset = 0) {
  const inset = Math.min(0.12, Math.max(0, Number(safeInset) || 0))
  const padX = `${(inset / 2) * 100}%`
  const padY = `${(inset / 2) * 100}%`
  el.style.zoom = ''
  el.style.position = 'absolute'
  el.style.left = padX
  el.style.top = padY
  el.style.right = padX
  el.style.bottom = padY
  el.style.width = 'auto'
  el.style.height = 'auto'
  el.style.minWidth = '0'
  el.style.minHeight = '0'
  el.style.maxWidth = 'none'
  el.style.maxHeight = 'none'
  el.style.transform = 'none'
  el.style.webkitTransform = 'none'
  el.style.transformOrigin = ''
  el.style.webkitTransformOrigin = ''
  el.setAttribute('data-viewport-fit', 'stretch')
  document.documentElement.setAttribute('data-tv-board-fit', 'stretch')
}

function applyTransformFit(el, fit) {
  const transform = `scale(${fit.scaleX}, ${fit.scaleY})`
  el.style.zoom = ''
  el.style.position = 'absolute'
  el.style.left = `${fit.offsetLeft}px`
  el.style.top = `${fit.offsetTop}px`
  el.style.right = 'auto'
  el.style.bottom = 'auto'
  el.style.width = `${fit.layoutWidth}px`
  el.style.height = `${fit.layoutHeight}px`
  el.style.minWidth = `${fit.layoutWidth}px`
  el.style.minHeight = `${fit.layoutHeight}px`
  el.style.maxWidth = 'none'
  el.style.maxHeight = 'none'
  el.style.transformOrigin = 'top left'
  el.style.webkitTransformOrigin = 'top left'
  el.style.transform = transform
  el.style.webkitTransform = transform
  el.setAttribute('data-viewport-fit', fit.mode)
  document.documentElement.setAttribute('data-tv-board-fit', fit.mode)
}

function fillsHost(el, hostW, hostH, safeInset = 0) {
  try {
    const rect = el.getBoundingClientRect()
    const inset = Math.min(0.12, Math.max(0, Number(safeInset) || 0))
    const targetW = hostW * (1 - inset)
    const targetH = hostH * (1 - inset)
    return rect.width >= targetW * 0.92 && rect.height >= targetH * 0.92
  } catch {
    return false
  }
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
    /** @deprecated kept for call-site compat; screen-size heuristics decide enablement. */
    minViewportWidth = 600,
    mode = 'fill',
    /** TV overscan safe margin (0–0.12). Default keeps edges inside the bezel. */
    safeInset = 0.025,
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
      const { width: vw, height: vh } = readViewportSize(el)

      if (!shouldEnableBoardFit(vw, vh) && vw < minViewportWidth) {
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
        safeInset,
      })

      applyTransformFit(el, fit)

      // If transform is ignored (common on some TV WebViews), stretch to host.
      if (!fillsHost(el, vw, vh, safeInset)) {
        applyStretchFallback(el, safeInset)
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
    // Re-measure after layout / font / TV browser chrome settle.
    const t1 = window.setTimeout(schedule, 50)
    const t2 = window.setTimeout(schedule, 300)

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    const vv = window.visualViewport
    vv?.addEventListener?.('resize', schedule)
    vv?.addEventListener?.('scroll', schedule)

    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.width = '100%'
    document.documentElement.style.height = '100%'
    document.body.style.width = '100%'
    document.body.style.height = '100%'
    const root = document.getElementById('root')
    const prevRoot = root ? { w: root.style.width, h: root.style.height, o: root.style.overflow } : null
    if (root) {
      root.style.width = '100%'
      root.style.height = '100%'
      root.style.overflow = 'hidden'
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      vv?.removeEventListener?.('resize', schedule)
      vv?.removeEventListener?.('scroll', schedule)
      clearFitStyles(el)
      el.removeAttribute('data-viewport-fit')
      document.documentElement.removeAttribute('data-tv-board-fit')
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.documentElement.style.width = ''
      document.documentElement.style.height = ''
      document.body.style.width = ''
      document.body.style.height = ''
      if (root && prevRoot) {
        root.style.width = prevRoot.w
        root.style.height = prevRoot.h
        root.style.overflow = prevRoot.o
      }
    }
  }, [ref, designWidth, designHeight, enabled, minViewportWidth, mode, safeInset])
}

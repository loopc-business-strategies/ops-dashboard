import { useLayoutEffect } from 'react'

/**
 * Light TV fit for fullscreen surfaces only (login / production control center).
 * Does NOT wrap the ops AppShell — that made Sales/ERP look zoomed.
 *
 * Activates only on Full-HD+ displays when the browser nearly fills the screen
 * (wall TV / kiosk). Windowed PC browsers stay on normal responsive CSS.
 *
 * Uses transform: scale() with a small overscan inset (no CSS zoom).
 */

export function isTvSurfaceCandidate({
  innerWidth,
  innerHeight,
  screenWidth,
  screenHeight,
} = {}) {
  const iw = Math.max(1, Number(innerWidth) || 0)
  const ih = Math.max(1, Number(innerHeight) || 0)
  const sw = Math.max(0, Number(screenWidth) || 0)
  const sh = Math.max(0, Number(screenHeight) || 0)
  // Prefer physical screen; fall back to CSS size when screen APIs are empty.
  const displayW = Math.max(sw, iw)
  const displayH = Math.max(sh, ih)
  if (displayW < 1920 || displayH < 1000) return false
  // Nearly fullscreen on that display (address bar OK).
  const refW = sw > 0 ? sw : displayW
  const refH = sh > 0 ? sh : displayH
  return iw >= refW * 0.85 && ih >= refH * 0.78
}

export function computeTvSurfaceFit({
  viewportWidth,
  viewportHeight,
  designWidth = 1920,
  designHeight = 1080,
  safeInset = 0.03,
  minScale = 0.35,
  maxScale = 4,
} = {}) {
  const vw = Math.max(1, Number(viewportWidth) || 1)
  const vh = Math.max(1, Number(viewportHeight) || 1)
  const dw = Math.max(1, Number(designWidth) || 1920)
  const dh = Math.max(1, Number(designHeight) || 1080)
  const inset = Math.min(0.1, Math.max(0, Number(safeInset) || 0))
  const usableW = vw * (1 - inset)
  const usableH = vh * (1 - inset)
  // Uniform scale (contain) — keeps cards proportional, no stretch zoom look.
  const scale = Math.min(maxScale, Math.max(minScale, Math.min(usableW / dw, usableH / dh)))
  return {
    scale,
    layoutWidth: dw,
    layoutHeight: dh,
    offsetLeft: (vw - dw * scale) / 2,
    offsetTop: (vh - dh * scale) / 2,
  }
}

function readSize() {
  const vv = window.visualViewport
  const iw = window.innerWidth || document.documentElement.clientWidth || 0
  const ih = window.innerHeight || document.documentElement.clientHeight || 0
  const sw = Number(window.screen?.availWidth || window.screen?.width || 0)
  const sh = Number(window.screen?.availHeight || window.screen?.height || 0)
  let width = Math.max(iw, vv?.width || 0, 1)
  let height = Math.max(ih, vv?.height || 0, 1)
  // TCL under-report: CSS ~half of physical Full HD.
  if (sw >= 1920 && width <= sw * 0.6) width = sw
  if (sh >= 1080 && height <= sh * 0.6) height = sh
  return {
    width,
    height,
    screenWidth: sw,
    screenHeight: sh,
    innerWidth: iw,
    innerHeight: ih,
  }
}

function clear(el) {
  el.style.position = ''
  el.style.left = ''
  el.style.top = ''
  el.style.width = ''
  el.style.height = ''
  el.style.maxWidth = ''
  el.style.maxHeight = ''
  el.style.transform = ''
  el.style.webkitTransform = ''
  el.style.transformOrigin = ''
  el.style.webkitTransformOrigin = ''
  el.removeAttribute('data-tv-surface')
  document.documentElement.removeAttribute('data-tv-surface')
}

/**
 * @param {React.RefObject<HTMLElement|null>} ref
 * @param {{ designWidth?: number, designHeight?: number, enabled?: boolean, safeInset?: number }} [options]
 */
export function useTvSurfaceFit(ref, options = {}) {
  const {
    designWidth = 1920,
    designHeight = 1080,
    enabled = true,
    safeInset = 0.03,
  } = options

  useLayoutEffect(() => {
    const el = ref?.current
    if (!el || !enabled) {
      if (el) clear(el)
      document.documentElement.removeAttribute('data-tv-surface')
      return undefined
    }

    let raf = 0
    const apply = () => {
      const size = readSize()
      const candidate = isTvSurfaceCandidate({
        innerWidth: size.innerWidth,
        innerHeight: size.innerHeight,
        screenWidth: size.screenWidth,
        screenHeight: size.screenHeight,
      }) || (
        // Under-reported CSS but physical TV is Full HD+
        size.screenWidth >= 1920 && size.screenHeight >= 1000
      )

      if (!candidate) {
        clear(el)
        return
      }

      const fit = computeTvSurfaceFit({
        viewportWidth: size.width,
        viewportHeight: size.height,
        designWidth,
        designHeight,
        safeInset,
      })

      el.setAttribute('data-tv-surface', 'contain')
      document.documentElement.setAttribute('data-tv-surface', 'contain')
      el.style.position = 'absolute'
      el.style.left = `${fit.offsetLeft}px`
      el.style.top = `${fit.offsetTop}px`
      el.style.width = `${fit.layoutWidth}px`
      el.style.height = `${fit.layoutHeight}px`
      el.style.maxWidth = 'none'
      el.style.maxHeight = 'none'
      el.style.transformOrigin = 'top left'
      el.style.webkitTransformOrigin = 'top left'
      const t = `scale(${fit.scale})`
      el.style.transform = t
      el.style.webkitTransform = t
    }

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        apply()
      })
    }

    apply()
    const t1 = window.setTimeout(schedule, 80)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener?.('resize', schedule)

    const parent = el.parentElement
    if (parent) {
      parent.style.overflow = 'hidden'
      parent.style.position = parent.style.position || 'relative'
    }

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener?.('resize', schedule)
      clear(el)
    }
  }, [ref, designWidth, designHeight, enabled, safeInset])
}

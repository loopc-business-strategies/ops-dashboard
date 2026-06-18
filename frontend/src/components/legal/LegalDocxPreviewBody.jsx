import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'

const DOCX_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
}

function sanitizeDocxHtml(html) {
  return DOMPurify.sanitize(String(html || ''), DOCX_SANITIZE_OPTIONS)
}

export default function LegalDocxPreviewBody({ arrayBuffer, showToast, hostClassName = 'legal-docx-preview-host', hostStyle }) {
  const hostRef = useRef(null)
  const toastRef = useRef(showToast)
  toastRef.current = showToast

  useEffect(() => {
    const el = hostRef.current
    if (!el || !arrayBuffer) return undefined
    let cancelled = false
    el.replaceChildren()

    ;(async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled) return
        const renderHost = document.createElement('div')
        await renderAsync(arrayBuffer, renderHost, undefined, { inWrapper: true })
        if (cancelled) return
        el.innerHTML = sanitizeDocxHtml(renderHost.innerHTML)
      } catch (e) {
        if (!cancelled) {
          el.replaceChildren()
          const p = document.createElement('p')
          p.style.cssText = 'padding:16px;color:#b91c1c;font-size:13px;line-height:1.5'
          p.textContent = e?.message || 'Could not render Word preview.'
          el.appendChild(p)
          toastRef.current?.('Preview', e?.message || 'Word preview failed.')
        }
      }
    })()

    return () => {
      cancelled = true
      if (el) el.replaceChildren()
    }
  }, [arrayBuffer])

  return (
    <div
      ref={hostRef}
      className={hostClassName}
      style={{ padding: '12px 16px', minHeight: 280, fontSize: 12, ...hostStyle }}
    />
  )
}

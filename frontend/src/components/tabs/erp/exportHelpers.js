export const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadCsv(rows, fileName) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), fileName)
}

export function createHtmlExportRoot(html, width = '1120px') {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(html, 'text/html')
  const exportRoot = document.createElement('div')
  exportRoot.style.position = 'fixed'
  exportRoot.style.left = '-10000px'
  exportRoot.style.top = '0'
  exportRoot.style.width = width
  exportRoot.style.opacity = '1'
  exportRoot.style.pointerEvents = 'none'
  exportRoot.style.background = '#FFFFFF'

  const style = document.createElement('style')
  style.textContent = parsed.querySelector('style')?.textContent || ''
  exportRoot.appendChild(style)
  Array.from(parsed.body.childNodes).forEach((node) => {
    exportRoot.appendChild(node.cloneNode(true))
  })
  document.body.appendChild(exportRoot)
  return exportRoot
}

const waitForLayout = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
    return
  }
  setTimeout(resolve, 0)
})

const waitForImages = (doc) => Promise.all(
  Array.from(doc?.images || []).map((img) => (
    img.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
  )),
)

/**
 * Mount full HTML in an off-screen iframe for html2pdf capture (matches View Statement layout).
 */
export async function mountHtmlExportDocument(html, { width = '1120px' } = {}) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width,
    height: '794px',
    border: 'none',
    opacity: '1',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  doc.open()
  doc.write(html)
  doc.close()

  await new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === 'complete') resolve()
    else iframe.onload = () => resolve()
  })
  if (doc.fonts?.ready) await doc.fonts.ready
  await waitForImages(doc)
  await waitForLayout()

  const cleanup = () => {
    iframe.remove()
  }
  return { element: doc.body, cleanup }
}

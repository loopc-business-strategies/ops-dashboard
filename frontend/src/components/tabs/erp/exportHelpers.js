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

const waitForDocumentReady = async (doc) => {
  await new Promise((resolve) => {
    if (doc.readyState === 'complete') resolve()
    else doc.defaultView?.addEventListener('load', resolve, { once: true })
  })
  if (doc.fonts?.ready) await doc.fonts.ready
  await waitForImages(doc)
  await waitForLayout()
}

/**
 * Open statement HTML in a new tab (same rendering path as View Statement).
 */
export async function openStatementHtmlWindow(html) {
  const win = window.open('', '_blank')
  if (!win) throw new Error('Popup blocked')
  win.document.open()
  win.document.write(html)
  win.document.close()
  await waitForDocumentReady(win.document)
  return win
}

/**
 * Print statement HTML using the browser print engine (matches View Statement + Ctrl+P).
 */
export async function printStatementHtml(html) {
  const win = await openStatementHtmlWindow(html)
  win.focus()
  win.print()
  return win
}

export async function downloadXlsxRows(rows, fileName, sheetName = 'Report') {
  return downloadXlsxSheets([{ rows, sheetName }], fileName)
}

export async function downloadXlsxSheets(sheets = [], fileName) {
  const { loadExcel } = await import('./lazyExportLibs')
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  sheets.forEach(({ rows, sheetName = 'Report' }) => {
    const worksheet = workbook.addWorksheet(sheetName)
    ;(rows || []).forEach((row) => {
      worksheet.addRow(Array.isArray(row) ? row : [row])
    })
  })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, fileName)
}

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
    border: 'none',
    opacity: '1',
    pointerEvents: 'none',
  })
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  doc.open()
  doc.write(html)
  doc.close()

  await waitForDocumentReady(doc)

  const sheet = doc.querySelector('.sheet') || doc.body
  const contentWidth = Math.ceil(sheet.scrollWidth || parseInt(width, 10) || 1120)
  const contentHeight = Math.ceil(Math.max(
    sheet.scrollHeight,
    sheet.getBoundingClientRect().height,
    doc.body.scrollHeight,
    794,
  ))
  iframe.style.width = `${contentWidth}px`
  iframe.style.height = `${contentHeight}px`
  await waitForLayout()

  const cleanup = () => {
    iframe.remove()
  }
  return { element: sheet, cleanup }
}

/**
 * Download statement HTML as a real PDF file (html2pdf + off-screen iframe capture).
 */
export async function downloadStatementPdf(html, fileName) {
  let cleanup = () => {}
  try {
    const { loadHtmlToPdf } = await import('./lazyExportLibs')
    const html2pdf = await loadHtmlToPdf()
    const mount = await mountHtmlExportDocument(html)
    cleanup = mount.cleanup

    await html2pdf().set({
      margin: 0,
      filename: fileName,
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1120,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'landscape',
      },
    }).from(mount.element).save()
  } finally {
    cleanup()
  }
}

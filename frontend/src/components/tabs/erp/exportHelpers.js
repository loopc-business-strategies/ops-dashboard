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
  exportRoot.style.left = '0'
  exportRoot.style.top = '0'
  exportRoot.style.width = width
  exportRoot.style.opacity = '0'
  exportRoot.style.pointerEvents = 'none'
  exportRoot.style.zIndex = '-1'
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

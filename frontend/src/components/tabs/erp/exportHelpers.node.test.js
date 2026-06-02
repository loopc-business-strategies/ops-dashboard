// @vitest-environment jsdom

import { afterEach, describe, expect, test } from 'vitest'
import { mountHtmlExportDocument } from './exportHelpers'

const sampleHtml = `
  <html>
    <head><title>Statement</title></head>
    <body>
      <div class="sheet">Balance C/F</div>
    </body>
  </html>
`

describe('exportHelpers – mountHtmlExportDocument', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('mounts iframe without opacity zero so html2canvas can capture content', async () => {
    const { cleanup } = await mountHtmlExportDocument(sampleHtml)
    const iframe = document.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe.style.opacity).not.toBe('0')
    expect(iframe.style.left).toBe('-10000px')
    cleanup()
  })

  test('renders full HTML document body content in mounted element', async () => {
    const { element, cleanup } = await mountHtmlExportDocument(sampleHtml)
    expect(element.textContent).toContain('Balance C/F')
    cleanup()
  })

  test('cleanup removes iframe from DOM', async () => {
    const { cleanup } = await mountHtmlExportDocument(sampleHtml)
    expect(document.querySelector('iframe')).toBeTruthy()
    cleanup()
    expect(document.querySelector('iframe')).toBeNull()
  })
})

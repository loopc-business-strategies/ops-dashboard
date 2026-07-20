// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from 'vitest'
import { downloadStatementPdf, mountHtmlExportDocument, openStatementHtmlWindow, printStatementHtml } from './exportHelpers'

vi.mock('./lazyExportLibs', () => ({
  loadHtmlToPdf: vi.fn(),
}))

import { loadHtmlToPdf } from './lazyExportLibs'

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

  test('targets the .sheet element when present', async () => {
    const { element, cleanup } = await mountHtmlExportDocument(sampleHtml)
    expect(element.classList.contains('sheet')).toBe(true)
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

describe('exportHelpers – statement window helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('openStatementHtmlWindow writes HTML into a new tab document', async () => {
    const mockDoc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: 'complete',
      fonts: { ready: Promise.resolve() },
      images: [],
      defaultView: null,
    }
    const mockWin = {
      document: mockDoc,
      focus: vi.fn(),
      print: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(mockWin)

    const win = await openStatementHtmlWindow(sampleHtml)
    expect(win).toBe(mockWin)
    expect(mockDoc.write).toHaveBeenCalledWith(sampleHtml)
  })

  test('printStatementHtml opens the statement and triggers browser print', async () => {
    const mockDoc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: 'complete',
      fonts: { ready: Promise.resolve() },
      images: [],
      defaultView: null,
    }
    const mockWin = {
      document: mockDoc,
      focus: vi.fn(),
      print: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(mockWin)

    await printStatementHtml(sampleHtml)
    expect(mockWin.print).toHaveBeenCalled()
  })
})

describe('exportHelpers – downloadStatementPdf', () => {
  afterEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  test('saves pdf via html2pdf and removes iframe', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const from = vi.fn().mockReturnValue({ save })
    const set = vi.fn().mockReturnValue({ from })
    loadHtmlToPdf.mockResolvedValue(() => ({ set }))

    await downloadStatementPdf(sampleHtml, 'Statement-TEST-2026-07-20.pdf')

    expect(loadHtmlToPdf).toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'Statement-TEST-2026-07-20.pdf',
      jsPDF: expect.objectContaining({ orientation: 'landscape' }),
    }))
    expect(from).toHaveBeenCalled()
    expect(save).toHaveBeenCalled()
    expect(document.querySelector('iframe')).toBeNull()
  })

  test('cleans up iframe when save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('save failed'))
    const from = vi.fn().mockReturnValue({ save })
    const set = vi.fn().mockReturnValue({ from })
    loadHtmlToPdf.mockResolvedValue(() => ({ set }))

    await expect(downloadStatementPdf(sampleHtml, 'Statement-TEST.pdf')).rejects.toThrow('save failed')
    expect(document.querySelector('iframe')).toBeNull()
  })
})

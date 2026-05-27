const {
  inferMimeFromFilename,
  isInlinePreviewMimeType,
  resolveAttachmentContentDisposition,
} = require('../services/erpAccounting/attachmentDownloadHeaders')

describe('attachmentDownloadHeaders', () => {
  test('defaults to attachment when preview is not requested', () => {
    const header = resolveAttachmentContentDisposition(
      { query: {} },
      { mimeType: 'application/pdf', filename: 'invoice.pdf' }
    )
    expect(header).toBe('attachment; filename="invoice.pdf"')
  })

  test('allows inline preview only for trusted mime types', () => {
    const header = resolveAttachmentContentDisposition(
      { query: { preview: '1' } },
      { mimeType: 'application/pdf', filename: 'invoice.pdf' }
    )
    expect(header).toBe('inline; filename="invoice.pdf"')
  })

  test('rejects inline preview for non-trusted mime types', () => {
    const header = resolveAttachmentContentDisposition(
      { query: { preview: '1' } },
      { mimeType: 'application/zip', filename: 'archive.zip' }
    )
    expect(header).toBe('attachment; filename="archive.zip"')
  })

  test('download=1 always forces attachment', () => {
    const header = resolveAttachmentContentDisposition(
      { query: { download: '1', preview: '1' } },
      { mimeType: 'application/pdf', filename: 'invoice.pdf' }
    )
    expect(header).toBe('attachment; filename="invoice.pdf"')
  })
})

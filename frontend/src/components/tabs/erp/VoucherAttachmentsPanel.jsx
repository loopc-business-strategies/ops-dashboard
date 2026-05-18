const VOUCHER_ATTACHMENT_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.zip',
].join(',')

const PREVIEWABLE_ATTACHMENT_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'text/plain',
  'text/csv',
])

const formatFileSize = (bytes) => {
  const size = Number(bytes || 0)
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const canPreviewAttachment = (attachment) => PREVIEWABLE_ATTACHMENT_MIME.has(String(attachment?.mimeType || '').toLowerCase())

export default function VoucherAttachmentsPanel({
  editingId,
  attachments,
  isReadOnly,
  saving,
  attachmentInputKey,
  onUpload,
  onPreview,
  onDelete,
  styles,
}) {
  const { sectionBox, sectionHeader, sectionBody, btn, S } = styles
  const rows = Array.isArray(attachments) ? attachments : []

  return (
    <div style={sectionBox}>
      <div style={sectionHeader}>Attachments</div>
      <div style={{ ...sectionBody, display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            ...btn(editingId && !isReadOnly ? 'primary' : 'gray'),
            opacity: editingId && !isReadOnly && !saving ? 1 : 0.55,
            cursor: editingId && !isReadOnly && !saving ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}>
            📎 Upload Files
            <input
              key={attachmentInputKey}
              type="file"
              multiple
              accept={VOUCHER_ATTACHMENT_ACCEPT}
              disabled={!editingId || isReadOnly || saving}
              onChange={(event) => onUpload(event.target.files)}
              style={{ display: 'none' }}
            />
          </label>
          <span style={{ color: S.muted, fontSize: '0.78rem' }}>
            PDF, Word, Excel, PowerPoint, images, CSV, text, and ZIP files are supported.
          </span>
        </div>

        {!editingId && (
          <div style={{ color: S.muted, fontSize: '0.875rem', textAlign: 'center', padding: '1.25rem', border: `1px dashed ${S.border}`, borderRadius: '0.4rem' }}>
            Save the voucher first, then add attachments.
          </div>
        )}

        {editingId && rows.length === 0 && (
          <div style={{ color: S.muted, fontSize: '0.875rem', textAlign: 'center', padding: '1.25rem', border: `1px dashed ${S.border}`, borderRadius: '0.4rem' }}>
            No attachments added to this voucher yet.
          </div>
        )}

        {editingId && rows.length > 0 && (
          <div style={{ border: `1px solid ${S.border}`, borderRadius: '0.4rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ background: '#F3F4F6' }}>
                <tr>
                  <th style={{ padding: '0.48rem 0.6rem', textAlign: 'left', borderBottom: `1px solid ${S.border}` }}>File</th>
                  <th style={{ padding: '0.48rem 0.6rem', textAlign: 'left', borderBottom: `1px solid ${S.border}` }}>Type</th>
                  <th style={{ padding: '0.48rem 0.6rem', textAlign: 'right', borderBottom: `1px solid ${S.border}` }}>Size</th>
                  <th style={{ padding: '0.48rem 0.6rem', textAlign: 'right', borderBottom: `1px solid ${S.border}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((attachment) => {
                  const id = attachment._id || attachment.id || attachment.fileName
                  const previewable = canPreviewAttachment(attachment)
                  return (
                    <tr key={id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '0.5rem 0.6rem', color: S.ink, fontWeight: 600 }}>
                        {attachment.originalName || attachment.fileName || 'Attachment'}
                        <div style={{ color: S.muted, fontSize: '0.72rem', fontWeight: 400 }}>
                          Uploaded {attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', color: S.muted }}>{attachment.mimeType || 'file'}</td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: S.muted }}>{formatFileSize(attachment.size)}</td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" style={btn('secondary')} onClick={() => onPreview(attachment, false)}>
                            {previewable ? 'Preview' : 'Open/Download'}
                          </button>
                          <button type="button" style={btn('secondary')} onClick={() => onPreview(attachment, true)}>
                            Download
                          </button>
                          {!isReadOnly && (
                            <button type="button" disabled={saving} style={btn('danger')} onClick={() => onDelete(id)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

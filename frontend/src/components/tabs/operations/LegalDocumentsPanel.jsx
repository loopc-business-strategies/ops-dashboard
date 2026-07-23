import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  listOperationsLegalDocuments,
  listOperationsLegalFolders,
  createOperationsLegalFolder,
  deleteOperationsLegalFolder,
  renameOperationsLegalFolder,
  uploadOperationsLegalDocument,
  deleteOperationsLegalDocument,
  fetchOperationsLegalDocumentBlob,
  normalizeLegalDocumentId,
} from '../../../api/operationsLegalDocuments'
import LegalDocxPreviewBody from '../../legal/LegalDocxPreviewBody'
import { OPS_C as C } from './operationsTabTokens'
import {
  B,
  Card,
  CardTitle,
} from './operationsTabUI'

const LEGAL_DOC_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.zip',
].join(',')

function formatLegalDocSize(bytes) {
  const size = Number(bytes || 0)
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** Avoid showing JavaScript NaN / empty garbage for uploader name. */
function formatLegalDocUploader(name) {
  if (name == null || name === '') return '—'
  const s = String(name).trim()
  if (!s || s === 'NaN' || s === 'undefined' || s === 'null') return '—'
  return s
}

/** Returns preview UI kind. `.docx` uses client-side render (docx-preview); legacy `.doc` stays download-only. */
function legalDocPreviewKind(mime, fileName = '') {
  const m = String(mime || '').toLowerCase()
  const base = String(fileName || '').trim().toLowerCase()
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : ''
  if (m === 'application/pdf') return 'iframe'
  if (m.startsWith('image/')) return 'img'
  if (m === 'text/plain' || m === 'text/csv') return 'text'
  const docxMime = m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const looksDocx = ext === 'docx' || docxMime || (m === 'application/octet-stream' && ext === 'docx')
  if (looksDocx) return 'docx'
  return 'none'
}

function LegalDocumentsCard({ canEdit, showToast }) {
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast
  const selectAllCheckboxRef = useRef(null)

  /** 'all' | 'unfiled' | folder Mongo id */
  const [folderScope, setFolderScope] = useState('all')
  const [folders, setFolders] = useState([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  /** Right-click menu on a folder chip: `{ folder, x, y }` */
  const [folderContextMenu, setFolderContextMenu] = useState(null)
  const legalFolderContextFileRef = useRef(null)
  const legalFolderContextTargetRef = useRef(null)
  /** Normalized document _id strings for bulk select / share / download */
  const [selectedLegalDocIds, setSelectedLegalDocIds] = useState([])

  const visibleDocIds = useMemo(
    () => documents.map((d) => normalizeLegalDocumentId(d._id)).filter(Boolean),
    [documents],
  )
  const selectedInViewCount = useMemo(
    () => visibleDocIds.filter((id) => selectedLegalDocIds.includes(id)).length,
    [visibleDocIds, selectedLegalDocIds],
  )
  const allVisibleSelected = visibleDocIds.length > 0 && selectedInViewCount === visibleDocIds.length

  useEffect(() => {
    const el = selectAllCheckboxRef.current
    if (el) el.indeterminate = selectedInViewCount > 0 && !allVisibleSelected
  }, [selectedInViewCount, allVisibleSelected])

  useEffect(() => {
    setSelectedLegalDocIds([])
  }, [folderScope])

  useEffect(() => {
    const valid = new Set(visibleDocIds)
    setSelectedLegalDocIds((prev) => prev.filter((id) => valid.has(id)))
  }, [visibleDocIds])

  useEffect(() => {
    if (!folderContextMenu) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setFolderContextMenu(null) }
    const onDown = (e) => {
      const t = e.target
      if (t && typeof t.closest === 'function' && t.closest('[data-legal-folder-context-menu]')) return
      setFolderContextMenu(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown, true)
    }
  }, [folderContextMenu])

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true)
    try {
      const data = await listOperationsLegalFolders()
      setFolders(Array.isArray(data.folders) ? data.folders : [])
    } catch {
      setFolders([])
    } finally {
      setFoldersLoading(false)
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      const opts = {}
      if (folderScope === 'unfiled') opts.folderId = 'unfiled'
      else if (folderScope !== 'all') opts.folderId = folderScope
      const data = await listOperationsLegalDocuments(opts)
      const rows = Array.isArray(data.documents) ? data.documents : []
      setDocuments(
        rows.map((row) => {
          const nid = normalizeLegalDocumentId(row._id)
          return nid ? { ...row, _id: nid } : row
        }),
      )
    } catch {
      setDocuments([])
      showToastRef.current('Legal documents', 'Could not load document list.')
    } finally {
      setLoading(false)
    }
  }, [folderScope])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadDocuments() }, [loadDocuments])

  const closePreview = useCallback(() => {
    if (preview?.objectUrl) {
      try { URL.revokeObjectURL(preview.objectUrl) } catch { /* ignore */ }
    }
    setPreview(null)
  }, [preview])

  const openPreview = useCallback(async (doc) => {
    const id = normalizeLegalDocumentId(doc?._id)
    const kind = legalDocPreviewKind(doc.mimeType, doc.originalName)
    if (!id) {
      showToastRef.current('Preview', 'Missing document id.')
      return
    }
    if (kind === 'none') {
      setPreview({
        objectUrl: null,
        name: doc.originalName,
        kind: 'office',
        docId: id,
      })
      return
    }
    try {
      const blob = await fetchOperationsLegalDocumentBlob(id, { preview: true })
      if (kind === 'text') {
        const text = await blob.text()
        setPreview({ objectUrl: null, name: doc.originalName, kind: 'text', text })
        return
      }
      if (kind === 'docx') {
        const docxArrayBuffer = await blob.arrayBuffer()
        setPreview({
          objectUrl: null,
          name: doc.originalName,
          kind: 'docx',
          docxArrayBuffer,
          docId: id,
        })
        return
      }
      const objectUrl = URL.createObjectURL(blob)
      if (kind === 'iframe' || kind === 'img') {
        setPreview({ objectUrl, name: doc.originalName, kind, docId: id })
      } else {
        URL.revokeObjectURL(objectUrl)
        setPreview({
          objectUrl: null,
          name: doc.originalName,
          kind: 'office',
          docId: id,
        })
      }
    } catch (err) {
      showToastRef.current('Preview', err?.message || 'Could not load file.')
    }
  }, [])

  const downloadToDisk = useCallback(async (doc) => {
    const id = normalizeLegalDocumentId(doc?._id || doc?.docId)
    const filename = doc?.originalName || doc?.name || 'document'
    if (!id) {
      showToastRef.current('Download', 'Invalid document.')
      return
    }
    try {
      const blob = await fetchOperationsLegalDocumentBlob(id, { download: true })
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.rel = 'noreferrer'
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      showToastRef.current('Download', err?.message || 'Could not download file.')
    }
  }, [])

  const getSelectedLegalDocs = useCallback(() => {
    const want = new Set(selectedLegalDocIds)
    return documents.filter((d) => want.has(normalizeLegalDocumentId(d._id)))
  }, [documents, selectedLegalDocIds])

  const shareLegalDocRows = useCallback(async (rows, contextSuffix) => {
    if (!rows.length) {
      showToastRef.current(
        'Share',
        contextSuffix ? `No documents ${contextSuffix}.` : 'Select one or more documents.',
      )
      return
    }
    const names = rows.map((r) => r.originalName || 'document').join('\n')
    try {
      const files = []
      for (const doc of rows) {
        const id = normalizeLegalDocumentId(doc._id)
        const blob = await fetchOperationsLegalDocumentBlob(id, { download: true })
        const name = doc.originalName || 'document'
        const type = doc.mimeType || blob.type || 'application/octet-stream'
        files.push(new File([blob], name, { type }))
      }
      const textIntro = contextSuffix
        ? `${files.length} file(s) ${contextSuffix}`
        : `${files.length} file(s) from Legal Documents`
      const sharePayload = {
        title: 'Operations — Legal documents',
        text: textIntro,
        files,
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
          await navigator.share(sharePayload)
        } else {
          await navigator.share({
            title: sharePayload.title,
            text: `${sharePayload.text}\n\n${names}`,
          })
        }
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(names)
        showToastRef.current(
          'Share',
          'This browser does not support sending files from the page. File names were copied — use Download selected to save copies, or paste the list into email or chat.',
        )
        return
      }
      showToastRef.current('Share', 'Sharing is not supported here. Use Download selected.')
    } catch (e) {
      if (e?.name === 'AbortError') return
      showToastRef.current('Share failed', e?.message || 'Could not share.')
    }
  }, [])

  const shareSelectedLegalDocs = useCallback(async () => {
    await shareLegalDocRows(getSelectedLegalDocs(), '')
  }, [getSelectedLegalDocs, shareLegalDocRows])

  const shareFolderDocuments = useCallback(async (folder) => {
    const fid = normalizeLegalDocumentId(folder._id)
    if (!fid) {
      showToastRef.current('Share', 'Invalid folder.')
      return
    }
    setFolderContextMenu(null)
    try {
      const data = await listOperationsLegalDocuments({ folderId: fid })
      const rows = (Array.isArray(data.documents) ? data.documents : []).map((row) => {
        const nid = normalizeLegalDocumentId(row._id)
        return nid ? { ...row, _id: nid } : row
      }).filter((row) => normalizeLegalDocumentId(row._id))
      await shareLegalDocRows(rows, `from folder "${folder.name}"`)
    } catch (e) {
      showToastRef.current('Share', e?.message || 'Could not load folder documents.')
    }
  }, [shareLegalDocRows])

  const downloadSelectedLegalDocs = useCallback(async () => {
    const rows = getSelectedLegalDocs()
    if (!rows.length) {
      showToastRef.current('Download', 'Select one or more documents.')
      return
    }
    for (let i = 0; i < rows.length; i++) {
      await downloadToDisk(rows[i])
      if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 280))
    }
    showToastRef.current('Download', `${rows.length} download(s) started.`)
  }, [getSelectedLegalDocs, downloadToDisk])

  const uploadTargetFolderId = folderScope !== 'all' && folderScope !== 'unfiled' ? folderScope : null

  const uploadLegalDocumentFile = useCallback(async (file, overrideFolderId) => {
    if (!file) return
    const effectiveFolderId = overrideFolderId !== undefined ? overrideFolderId : uploadTargetFolderId
    const folderParam = effectiveFolderId && /^[a-f\d]{24}$/i.test(String(effectiveFolderId))
      ? String(effectiveFolderId)
      : undefined
    setUploading(true)
    try {
      const data = await uploadOperationsLegalDocument(file, { folderId: folderParam })
      if (data.success && data.document) {
        const nid = normalizeLegalDocumentId(data.document._id)
        const d = nid ? { ...data.document, _id: nid } : data.document
        if (!nid) {
          await loadDocuments()
        } else {
          const inView = folderScope === 'all'
            || (folderScope === 'unfiled' && !d.folderId)
            || (String(folderScope) === String(d.folderId))
          if (inView) setDocuments((prev) => [d, ...prev])
          else await loadDocuments()
        }
        showToastRef.current('Uploaded', file.name)
      } else {
        showToastRef.current('Upload failed', data.message || 'Unknown error')
      }
    } catch (err) {
      showToastRef.current('Upload failed', err.response?.data?.message || err.message || 'Unknown error')
    } finally {
      setUploading(false)
    }
  }, [folderScope, loadDocuments, uploadTargetFolderId])

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    await uploadLegalDocumentFile(file)
  }

  const onLegalFolderContextFilePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const fid = legalFolderContextTargetRef.current
    legalFolderContextTargetRef.current = null
    if (!file || !fid) return
    await uploadLegalDocumentFile(file, fid)
  }

  const onDelete = async (doc) => {
    const docId = normalizeLegalDocumentId(doc._id)
    if (!docId) {
      showToastRef.current('Delete', 'This document has no valid id. Try refreshing the list.')
      return
    }
    if (!window.confirm(`Delete “${doc.originalName}”?`)) return
    try {
      await deleteOperationsLegalDocument(docId)
      if (preview && normalizeLegalDocumentId(preview.docId) === docId) {
        closePreview()
      }
      setSelectedLegalDocIds((prev) => prev.filter((id) => id !== docId))
      setDocuments((prev) => prev.filter((d) => normalizeLegalDocumentId(d._id) !== docId))
      showToastRef.current('Deleted', doc.originalName)
    } catch (err) {
      const body = err.response?.data
      const msg = (typeof body?.message === 'string' && body.message.trim())
        || (typeof body === 'string' && body.trim())
        || err.message
        || 'Could not remove document.'
      showToastRef.current('Delete failed', msg)
    }
  }

  const onCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    try {
      const data = await createOperationsLegalFolder(name)
      if (data.success && data.folder) {
        await loadFolders()
        setFolderScope(String(data.folder._id))
        setNewFolderOpen(false)
        setNewFolderName('')
        showToastRef.current('Folder created', name)
      } else {
        showToastRef.current('Folder', data.message || 'Could not create folder.')
      }
    } catch (err) {
      showToastRef.current('Folder', err.response?.data?.message || err.message || 'Could not create folder.')
    } finally {
      setCreatingFolder(false)
    }
  }

  const onDeleteFolder = async (folder) => {
    const fid = normalizeLegalDocumentId(folder._id)
    if (!fid) {
      showToastRef.current('Folder', 'Invalid folder id. Try refreshing.')
      return
    }
    if (!window.confirm(`Delete folder “${folder.name}”? (Must be empty.)`)) return
    try {
      await deleteOperationsLegalFolder(fid)
      await loadFolders()
      if (String(folderScope) === fid) setFolderScope('all')
      showToastRef.current('Folder deleted', folder.name)
    } catch (err) {
      const body = err.response?.data
      const msg = (typeof body?.message === 'string' && body.message.trim())
        || err.message
        || 'Could not delete folder.'
      showToastRef.current('Folder', msg)
    }
  }

  const onRenameLegalFolder = async (folder) => {
    const fid = normalizeLegalDocumentId(folder._id)
    if (!fid) {
      showToastRef.current('Folder', 'Invalid folder id. Try refreshing.')
      setFolderContextMenu(null)
      return
    }
    const current = String(folder.name || '').trim()
    setFolderContextMenu(null)
    const nextRaw = window.prompt('Rename folder', current)
    if (nextRaw == null) return
    const name = String(nextRaw).trim()
    if (!name || name === current) return
    try {
      const data = await renameOperationsLegalFolder(fid, name)
      if (data.success && data.folder) {
        await loadFolders()
        showToastRef.current('Folder renamed', name)
      } else {
        showToastRef.current('Folder', data.message || 'Could not rename folder.')
      }
    } catch (err) {
      const body = err.response?.data
      const msg = (typeof body?.message === 'string' && body.message.trim())
        || err.message
        || 'Could not rename folder.'
      showToastRef.current('Rename failed', msg)
    }
  }

  const chip = (active) => ({
    ...(active ? B.pri : B.ghost),
    ...B.sm,
    borderRadius: 999,
    whiteSpace: 'nowrap',
  })

  return (
    <>
      <Card>
        <CardTitle
          right={canEdit ? (
            <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
              <span style={{ ...B.sec, ...B.sm }}>＋ Add document</span>
              <input
                type="file"
                accept={LEGAL_DOC_ACCEPT}
                disabled={uploading}
                onChange={onPickFile}
                style={{ display: 'none' }}
              />
            </label>
          ) : null}
        >
          Legal Documents
        </CardTitle>
        {canEdit && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4, lineHeight: 1.4 }}>
            Select a folder below, then use <strong>Add document</strong> to save the file into that folder.
            Choose <strong>All</strong> or <strong>Unfiled</strong> to upload without a folder.
            {' '}
            <strong>Right-click</strong> a folder name for <strong>New file</strong>, <strong>Rename</strong>, <strong>Share</strong>, or <strong>Delete</strong>.
          </div>
        )}
        {!canEdit && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 4, lineHeight: 1.4 }}>
            <strong>Right-click</strong> a folder name to <strong>Share</strong> all documents in that folder.
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: `1px solid ${C.border}`,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 11, color: C.t3, fontWeight: 700 }}>Folders</span>
          <button type="button" onClick={() => setFolderScope('all')} style={chip(folderScope === 'all')}>
            All
          </button>
          <button type="button" onClick={() => setFolderScope('unfiled')} style={chip(folderScope === 'unfiled')}>
            Unfiled
          </button>
          {foldersLoading && <span style={{ fontSize: 11, color: C.t3 }}>…</span>}
          {!foldersLoading && folders.map((f) => (
            <button
              key={f._id}
              type="button"
              onClick={() => setFolderScope(String(f._id))}
              onContextMenu={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                setFolderContextMenu({ folder: f, x: ev.clientX, y: ev.clientY })
              }}
              style={chip(String(folderScope) === String(f._id))}
            >
              {f.name}
            </button>
          ))}
          {canEdit && !newFolderOpen && (
            <button type="button" onClick={() => { setNewFolderOpen(true); setNewFolderName('') }} style={{ ...B.ghost, ...B.sm, borderRadius: 999 }}>
              ＋ New folder
            </button>
          )}
          {canEdit && newFolderOpen && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                disabled={creatingFolder}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  fontSize: 12,
                  minWidth: 140,
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') onCreateFolder() }}
              />
              <button type="button" disabled={creatingFolder} onClick={onCreateFolder} style={{ ...B.pri, ...B.sm }}>
                {creatingFolder ? '…' : 'Create'}
              </button>
              <button
                type="button"
                disabled={creatingFolder}
                onClick={() => { setNewFolderOpen(false); setNewFolderName('') }}
                style={{ ...B.ghost, ...B.sm }}
              >
                Cancel
              </button>
            </span>
          )}
        </div>
        {loading && (
          <div style={{ fontSize: 12, color: C.t3, padding: '8px 0' }}>Loading…</div>
        )}
        {!loading && documents.length === 0 && (
          <div style={{ fontSize: 12, color: C.t3, padding: '12px 0', borderTop: `1px dashed ${C.border}` }}>
            No documents in this view.{canEdit ? ' Use Add document to upload PDF, Word, images, or other supported files.' : ''}
          </div>
        )}
        {!loading && documents.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 12,
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: documents.length ? 'pointer' : 'default',
                  color: C.t2,
                  fontWeight: 700,
                }}
              >
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  disabled={!documents.length}
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedLegalDocIds([...visibleDocIds])
                    else setSelectedLegalDocIds([])
                  }}
                  aria-label="Select all documents in this list"
                />
                Select all
              </label>
              <span style={{ color: C.t3 }}>
                {selectedLegalDocIds.length}
                {' '}
                selected
              </span>
              <button
                type="button"
                disabled={!selectedLegalDocIds.length}
                onClick={() => { void shareSelectedLegalDocs() }}
                style={{ ...B.sec, ...B.sm }}
              >
                Share
              </button>
              <button
                type="button"
                disabled={!selectedLegalDocIds.length}
                onClick={() => { void downloadSelectedLegalDocs() }}
                style={{ ...B.ghost, ...B.sm }}
              >
                Download selected
              </button>
              {selectedLegalDocIds.length > 0 && (
                <button type="button" onClick={() => setSelectedLegalDocIds([])} style={{ ...B.ghost, ...B.sm }}>
                  Clear selection
                </button>
              )}
            </div>
            {documents.map((doc, idx) => {
              const rowId = normalizeLegalDocumentId(doc._id)
              const rowChecked = rowId ? selectedLegalDocIds.includes(rowId) : false
              return (
                <div
                  key={doc._id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 0',
                    borderBottom: idx < documents.length - 1 ? `1px solid ${C.border}` : 'none',
                    fontSize: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      cursor: rowId ? 'pointer' : 'default',
                      minWidth: 0,
                      flex: '1 1 160px',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={!rowId}
                      checked={rowChecked}
                      onChange={() => {
                        if (!rowId) return
                        setSelectedLegalDocIds((prev) => (
                          prev.includes(rowId) ? prev.filter((x) => x !== rowId) : [...prev, rowId]
                        ))
                      }}
                      style={{ marginTop: 3, flexShrink: 0 }}
                      aria-label={`Select ${doc.originalName || 'document'}`}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: C.t1, wordBreak: 'break-word' }}>{doc.originalName}</span>
                      <div style={{ color: C.t3, marginTop: 4, fontSize: 11 }}>
                        {formatLegalDocSize(doc.size)}
                        {' · '}
                        {formatLegalDocUploader(doc.uploadedByName)}
                        {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleString()}` : ''}
                        {doc.folderId && folderScope === 'all' && (
                          <span>
                            {' · '}
                            Folder: {folders.find((x) => String(x._id) === String(doc.folderId))?.name || '—'}
                          </span>
                        )}
                      </div>
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                    <button
                      type="button"
                      onClick={() => openPreview(doc)}
                      style={{ ...B.ghost, ...B.sm }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadToDisk(doc)}
                      style={{ ...B.ghost, ...B.sm }}
                    >
                      Download
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => onDelete(doc)} style={{ ...B.warn, ...B.sm }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <input
        ref={legalFolderContextFileRef}
        type="file"
        accept={LEGAL_DOC_ACCEPT}
        style={{ display: 'none' }}
        disabled={uploading}
        onChange={(e) => { void onLegalFolderContextFilePick(e) }}
      />
      {folderContextMenu && (() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 800
        const vh = typeof window !== 'undefined' ? window.innerHeight : 600
        const left = Math.min(Math.max(8, folderContextMenu.x), vw - 176)
        const top = Math.min(Math.max(8, folderContextMenu.y), vh - (canEdit ? 200 : 100))
        const m = folderContextMenu.folder
        const itemStyle = {
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          color: C.t1,
          borderRadius: 6,
          fontFamily: 'inherit',
          fontWeight: 600,
        }
        return (
          <div
            data-legal-folder-context-menu
            role="menu"
            aria-label={`Folder actions: ${m.name}`}
            style={{
              position: 'fixed',
              left,
              top,
              zIndex: 10050,
              minWidth: 168,
              background: '#fff',
              border: `1px solid ${C.border2}`,
              borderRadius: 10,
              boxShadow: '0 12px 40px rgba(0,0,0,.15)',
              padding: 4,
            }}
          >
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                onClick={() => {
                  const fid = normalizeLegalDocumentId(m._id)
                  if (!fid) return
                  setFolderScope(fid)
                  legalFolderContextTargetRef.current = fid
                  setFolderContextMenu(null)
                  legalFolderContextFileRef.current?.click()
                }}
              >
                New file…
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                onClick={() => { void onRenameLegalFolder(m) }}
              >
                Rename folder…
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              style={itemStyle}
              onClick={() => { void shareFolderDocuments(m) }}
            >
              Share folder
            </button>
            {canEdit && (
              <button
                type="button"
                role="menuitem"
                style={{ ...itemStyle, color: C.red, fontWeight: 700 }}
                onClick={() => {
                  setFolderContextMenu(null)
                  void onDeleteFolder(m)
                }}
              >
                Delete folder
              </button>
            )}
          </div>
        )
      })()}

      {preview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.65)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(6px)',
          }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) closePreview() }}
          role="presentation"
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: `1px solid ${C.border2}`,
              maxWidth: 'min(920px, 96vw)',
              maxHeight: '90vh',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.gbar }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 800, color: C.t1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{preview.name}</div>
              <button type="button" onClick={closePreview} style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
              {preview.kind === 'iframe' && preview.objectUrl && (
                <iframe title={preview.name} src={preview.objectUrl} style={{ width: '100%', height: 'min(72vh, 640px)', border: 'none' }} />
              )}
              {preview.kind === 'img' && preview.objectUrl && (
                <div style={{ padding: 12, textAlign: 'center' }}>
                  <img src={preview.objectUrl} alt={preview.name} style={{ maxWidth: '100%', height: 'auto' }} />
                </div>
              )}
              {preview.kind === 'text' && (
                <pre style={{ margin: 0, padding: 14, fontSize: 12, color: C.t2, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, monospace' }}>{preview.text}</pre>
              )}
              {preview.kind === 'docx' && preview.docxArrayBuffer && (
                <LegalDocxPreviewBody arrayBuffer={preview.docxArrayBuffer} showToast={showToast} hostStyle={{ color: C.t2 }} />
              )}
              {preview.kind === 'office' && (
                <div style={{ padding: 24, fontSize: 13, color: C.t2, lineHeight: 1.5 }}>
                  <p style={{ margin: '0 0 12px' }}>In-browser preview is not available for this file type. Download to open it on your device.</p>
                  <button
                    type="button"
                    style={B.pri}
                    onClick={async () => {
                      await downloadToDisk({ _id: preview.docId, originalName: preview.name })
                      closePreview()
                    }}
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB: Legal Documents ───────────────────────────────────────────────────────
function TabLegalDocuments({ canEdit, showToast }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <LegalDocumentsCard canEdit={canEdit} showToast={showToast} />
    </div>
  )
}

export { TabLegalDocuments }
export default TabLegalDocuments

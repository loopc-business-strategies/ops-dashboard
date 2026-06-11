// FILE: src/api/operationsLegalDocuments.js
// HTTP: /api/operations/legal-documents — tenant-scoped Operations legal files.
import axios from './client'

const BASE = '/api/operations/legal-documents'

/** Normalize Mongo id from API (string, $oid wrapper, etc.) for URLs and keys. */
export function normalizeLegalDocumentId(id) {
  if (id == null) return ''
  if (typeof id === 'string') {
    const s = id.trim()
    return /^[a-f\d]{24}$/i.test(s) ? s : ''
  }
  if (typeof id === 'object') {
    const oid = id.$oid ?? id.id
    if (oid != null) return normalizeLegalDocumentId(String(oid))
    if (id._id != null) return normalizeLegalDocumentId(id._id)
  }
  return ''
}

/** @param {{ folderId?: 'unfiled'|string }} [opts] — omit or all: list every document; unfiled: no folder; else folder _id */
export async function listOperationsLegalDocuments(opts = {}) {
  const params = {}
  if (opts.folderId === 'unfiled') params.folderId = 'unfiled'
  else if (opts.folderId) params.folderId = opts.folderId
  return (await axios.get(BASE, { params })).data
}

export async function listOperationsLegalFolders() {
  return (await axios.get(`${BASE}/folders`)).data
}

export async function createOperationsLegalFolder(name) {
  return (await axios.post(`${BASE}/folders`, { name })).data
}

export async function deleteOperationsLegalFolder(id) {
  const raw = normalizeLegalDocumentId(id)
  if (!raw) {
    throw new Error('Invalid folder id')
  }
  return (await axios.delete(`${BASE}/folders/${encodeURIComponent(raw)}`)).data
}

/** @param {File} file @param {{ folderId?: string|null }} [opts] — pass folder Mongo id to file under that folder */
export async function uploadOperationsLegalDocument(file, opts = {}) {
  const fd = new FormData()
  fd.append('file', file)
  const fid = opts.folderId
  if (fid && fid !== 'all' && fid !== 'unfiled') {
    fd.append('folderId', String(fid))
  }
  // Let axios set multipart boundary; a bare "multipart/form-data" header breaks multer/body parsing.
  return (await axios.post(BASE, fd)).data
}

export async function deleteOperationsLegalDocument(id) {
  const raw = normalizeLegalDocumentId(id)
  if (!raw) {
    throw new Error('Invalid document id')
  }
  return (await axios.delete(`${BASE}/${encodeURIComponent(raw)}`)).data
}

/**
 * Download file bytes with the same auth + tenant headers as other API calls (fetch() skips axios defaults).
 * @param {string} id Document _id
 * @param {{ preview?: boolean, download?: boolean }} [opts]
 * @returns {Promise<Blob>}
 */
export async function fetchOperationsLegalDocumentBlob(id, { preview, download } = {}) {
  const raw = normalizeLegalDocumentId(id)
  if (!raw) {
    throw new Error('Invalid document id')
  }
  const params = {}
  if (preview) params.preview = '1'
  if (download) params.download = '1'
  const res = await axios.get(`${BASE}/${encodeURIComponent(raw)}/download`, {
    params,
    responseType: 'blob',
    validateStatus: () => true,
  })

  if (res.status < 200 || res.status >= 300) {
    let msg = `Request failed (${res.status})`
    try {
      const t = await res.data.text()
      const j = JSON.parse(t)
      if (j && typeof j.message === 'string' && j.message.trim()) msg = j.message.trim()
    } catch {
      /* ignore */
    }
    const err = new Error(msg)
    err.response = res
    throw err
  }

  const ct = String(res.headers['content-type'] || '').toLowerCase()
  if (ct.includes('application/json')) {
    try {
      const t = await res.data.text()
      const j = JSON.parse(t)
      throw new Error((j && j.message) || 'Server returned JSON instead of a file')
    } catch (e) {
      if (e instanceof Error && e.message) throw e
      throw new Error('Server returned JSON instead of a file')
    }
  }

  return res.data
}

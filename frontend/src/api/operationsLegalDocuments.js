// FILE: src/api/operationsLegalDocuments.js
// HTTP: /api/operations/legal-documents — tenant-scoped Operations legal files.
import axios from './client'

const BASE = '/api/operations/legal-documents'

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
  return (await axios.delete(`${BASE}/folders/${encodeURIComponent(id)}`)).data
}

/** @param {File} file @param {{ folderId?: string|null }} [opts] — pass folder Mongo id to file under that folder */
export async function uploadOperationsLegalDocument(file, opts = {}) {
  const fd = new FormData()
  fd.append('file', file)
  const fid = opts.folderId
  if (fid && fid !== 'all' && fid !== 'unfiled') {
    fd.append('folderId', String(fid))
  }
  return (await axios.post(BASE, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data
}

export async function deleteOperationsLegalDocument(id) {
  return (await axios.delete(`${BASE}/${encodeURIComponent(id)}`)).data
}

/**
 * Download file bytes with the same auth + tenant headers as other API calls (fetch() skips axios defaults).
 * @param {string} id Document _id
 * @param {{ preview?: boolean, download?: boolean }} [opts]
 * @returns {Promise<Blob>}
 */
export async function fetchOperationsLegalDocumentBlob(id, { preview, download } = {}) {
  const raw = String(id || '').trim()
  if (!/^[a-f\d]{24}$/i.test(raw)) {
    throw new Error('Invalid document id')
  }
  const params = {}
  if (preview) params.preview = '1'
  if (download) params.download = '1'
  const { data } = await axios.get(`${BASE}/${encodeURIComponent(raw)}/download`, {
    params,
    responseType: 'blob',
  })
  return data
}

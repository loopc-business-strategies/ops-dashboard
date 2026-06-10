// FILE: src/api/operationsLegalDocuments.js
// HTTP: /api/operations/legal-documents — tenant-scoped Operations legal files.
import axios, { apiUrl } from './client'

const BASE = '/api/operations/legal-documents'

export async function listOperationsLegalDocuments() {
  return (await axios.get(BASE)).data
}

export async function uploadOperationsLegalDocument(file) {
  const fd = new FormData()
  fd.append('file', file)
  return (await axios.post(BASE, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data
}

export async function deleteOperationsLegalDocument(id) {
  return (await axios.delete(`${BASE}/${encodeURIComponent(id)}`)).data
}

/** Authenticated download URL (use with fetch(..., { credentials: 'include' })). */
export function operationsLegalDocumentDownloadUrl(id, { preview, download } = {}) {
  const qs = new URLSearchParams()
  if (preview) qs.set('preview', '1')
  if (download) qs.set('download', '1')
  const q = qs.toString()
  return apiUrl(`${BASE}/${encodeURIComponent(id)}/download${q ? `?${q}` : ''}`)
}

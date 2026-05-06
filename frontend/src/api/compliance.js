import axios from 'axios'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE = `${API_ORIGIN}/api/compliance`

function cfg() {
  return { withCredentials: true }
}

function crudApi(path) {
  const url = `${BASE}${path}`
  return {
    list:   ()           => axios.get(url, cfg()).then(r => r.data.data || []),
    create: (body)       => axios.post(url, body, cfg()).then(r => r.data.data),
    update: (id, body)   => axios.put(`${url}/${id}`, body, cfg()).then(r => r.data.data),
    remove: (id)         => axios.delete(`${url}/${id}`, cfg()),
  }
}

const complianceAPI = {
  eligibility: crudApi('/eligibility'),
  approvals:   crudApi('/approvals'),
  docs:        crudApi('/docs'),
  updates:     crudApi('/updates'),
  agreements:  crudApi('/agreements'),
}

export default complianceAPI

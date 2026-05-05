import axios from 'axios'

const API_ORIGIN = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : ''
const BASE = `${API_ORIGIN}/api/training`

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

const trainingAPI = {
  sessions:    crudApi('/sessions'),
  batches:     crudApi('/batches'),
  attendance:  crudApi('/attendance'),
  resources:   crudApi('/resources'),
  assessments: crudApi('/assessments'),
  certs:       crudApi('/certs'),
  feedback:    crudApi('/feedback'),
  trainees:    crudApi('/trainees'),
}

export default trainingAPI

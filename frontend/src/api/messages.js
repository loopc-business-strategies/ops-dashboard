import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/messages`

const getLatestMessages = async (_token, type = 'all', limit = 20) =>
  (await axios.get(`${BASE}/latest`, { params: { type, limit } })).data

const getParticipants = async (_token) =>
  (await axios.get(`${BASE}/participants`)).data

const getGroups = async (_token) =>
  (await axios.get(`${BASE}/groups`)).data

const createGroup = async (_token, data) =>
  (await axios.post(`${BASE}/groups`, data)).data

const updateGroup = async (_token, id, data) =>
  (await axios.put(`${BASE}/groups/${id}`, data)).data

const deleteGroup = async (_token, id) =>
  (await axios.delete(`${BASE}/groups/${id}`)).data

const createMessage = async (_token, data) =>
  (await axios.post(BASE, data)).data

const createMessageWithAttachment = async (_token, formData) =>
  (await axios.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data

const attachmentUrl = (fileName) => `${BASE}/attachments/${encodeURIComponent(fileName)}`

const messagesAPI = {
  getLatestMessages,
  getParticipants,
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  createMessage,
  createMessageWithAttachment,
  attachmentUrl,
}

export default messagesAPI

import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/messages`

const getLatestMessages = async (_token, type = 'all', limit = 20) =>
  (await axios.get(`${BASE}/latest`, { params: { type, limit } })).data

const getParticipants = async (_token) =>
  (await axios.get(`${BASE}/participants`)).data

const createMessage = async (_token, data) =>
  (await axios.post(BASE, data)).data

const messagesAPI = {
  getLatestMessages,
  getParticipants,
  createMessage,
}

export default messagesAPI

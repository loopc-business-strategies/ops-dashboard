import axios from 'axios'

const API_ORIGIN = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : ''
const BASE = `${API_ORIGIN}/api/messages`

const getLatestMessages = async (_token, type = 'all', limit = 20) =>
  (await axios.get(`${BASE}/latest`, { params: { type, limit } })).data

const createMessage = async (_token, data) =>
  (await axios.post(BASE, data)).data

const messagesAPI = {
  getLatestMessages,
  createMessage,
}

export default messagesAPI

import axios from 'axios'

const BASE = '/api/messages'

const getLatestMessages = async (_token, type = 'all', limit = 20) =>
  (await axios.get(`${BASE}/latest`, { params: { type, limit } })).data

const createMessage = async (_token, data) =>
  (await axios.post(BASE, data)).data

const messagesAPI = {
  getLatestMessages,
  createMessage,
}

export default messagesAPI

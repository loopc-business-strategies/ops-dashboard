import axios from 'axios'

const BASE = '/api/messages'
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

const getLatestMessages = async (token, type = 'all', limit = 20) =>
  (await axios.get(`${BASE}/latest`, { params: { type, limit }, ...h(token) })).data

const createMessage = async (token, data) =>
  (await axios.post(BASE, data, h(token))).data

const messagesAPI = {
  getLatestMessages,
  createMessage,
}

export default messagesAPI

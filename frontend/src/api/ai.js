import axios from './client'
import { apiUrl } from './client'

const getConfig = async () => (await axios.get(apiUrl('/api/ai/config'))).data
const chat = async (payload) => (await axios.post(apiUrl('/api/ai/chat'), payload)).data

export default { getConfig, chat }

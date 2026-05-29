import axios from './client'
import { apiUrl } from './client'

const getConfig = async () => (await axios.get(apiUrl('/api/ai/config'))).data

const chat = async (payload) => (await axios.post(apiUrl('/api/ai/chat'), payload)).data

const chatWithFiles = async ({
  message,
  files = [],
  history = [],
  pageContext = {},
  lastError = null,
  provider = null,
  model = null,
}) => {
  const formData = new FormData()
  formData.append('message', message || 'Analyze the uploaded file(s).')
  formData.append('history', JSON.stringify(history))
  formData.append('pageContext', JSON.stringify(pageContext))
  if (lastError) formData.append('lastError', JSON.stringify(lastError))
  if (provider) formData.append('provider', provider)
  if (model) formData.append('model', model)
  files.forEach((file) => formData.append('files', file))

  return (await axios.post(apiUrl('/api/ai/chat/upload'), formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data
}

export default { getConfig, chat, chatWithFiles }

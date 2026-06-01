import { apiRequest } from '@/src/api/client'

export type ChatMessage = {
  _id?: string
  senderName?: string
  text?: string
  message?: string
  createdAt?: string
}

type LatestMessagesResponse = {
  success?: boolean
  messages?: ChatMessage[]
  rows?: ChatMessage[]
}

export async function fetchLatestMessages(
  token: string,
  type: 'all' | 'group' = 'all',
  limit = 40,
) {
  const data = await apiRequest<LatestMessagesResponse>('/api/messages/latest', {
    token,
    params: { type, limit },
  })
  return data.messages || data.rows || []
}

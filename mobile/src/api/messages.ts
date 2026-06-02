import { apiRequest, apiUploadRequest } from '@/src/api/client'
import type { ChatAttachment, CreateGroupPayload, CreateMessagePayload } from '@/src/types/chat'

export type ChatMessage = {
  _id?: string
  senderId?: string
  senderName?: string
  text?: string
  message?: string
  type?: 'group' | 'dm'
  room?: string
  department?: string
  groupId?: string
  recipientIds?: string[]
  recipientNames?: string[]
  attachments?: ChatAttachment[]
  createdAt?: string
}

export type ChatGroupRow = {
  _id?: string
  name?: string
  room?: string
  department?: string
  description?: string
  memberIds?: string[]
  createdBy?: string
  isActive?: boolean
}

export type ChatParticipantRow = {
  _id?: string
  id?: string
  name?: string
  fullName?: string
  email?: string
  role?: string
  department?: string
  title?: string
  employeeCode?: string
}

type LatestMessagesResponse = {
  success?: boolean
  messages?: ChatMessage[]
  rows?: ChatMessage[]
}

type ParticipantsResponse = {
  success?: boolean
  users?: ChatParticipantRow[]
}

type GroupsResponse = {
  success?: boolean
  groups?: ChatGroupRow[]
}

type CreateMessageResponse = {
  success?: boolean
  message?: ChatMessage
}

type CreateGroupResponse = {
  success?: boolean
  group?: ChatGroupRow
}

export async function fetchLatestMessages(
  token: string,
  type: 'all' | 'group' | 'dm' = 'all',
  limit = 100,
) {
  const data = await apiRequest<LatestMessagesResponse>('/api/messages/latest', {
    token,
    params: { type, limit },
  })
  return data.messages || data.rows || []
}

export async function fetchParticipants(token: string) {
  const data = await apiRequest<ParticipantsResponse>('/api/messages/participants', { token })
  return data.users || []
}

export async function fetchGroups(token: string) {
  const data = await apiRequest<GroupsResponse>('/api/messages/groups', { token })
  return data.groups || []
}

export async function createGroup(token: string, payload: CreateGroupPayload) {
  return apiRequest<CreateGroupResponse>('/api/messages/groups', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function createMessage(token: string, payload: CreateMessagePayload) {
  return apiRequest<CreateMessageResponse>('/api/messages', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function createMessageWithAttachment(
  token: string,
  formData: FormData,
) {
  return apiUploadRequest<CreateMessageResponse>('/api/messages', formData, token)
}

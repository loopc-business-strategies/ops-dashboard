export type ChatParticipant = {
  id: string
  name: string
  email?: string
  dept?: string
  title?: string
  employeeCode?: string
  color: string
  initials: string
}

export type ChatAttachment = {
  fileName: string
  originalName?: string
  mimeType?: string
  size?: number
  kind?: 'file' | 'image' | 'audio'
}

export type ChatMessageRow = {
  id: string
  from: string
  text: string
  time: string
  isMine: boolean
  attachments?: ChatAttachment[]
}

export type ChatConversation = {
  id: string
  type: 'direct' | 'group'
  name: string
  dept?: string
  room?: string
  groupId?: string
  otherId?: string
  members?: string[]
  unread: number
  muted: boolean
  messages: ChatMessageRow[]
  isLocalOnly?: boolean
}

export type CreateMessagePayload = {
  type: 'group' | 'dm'
  room?: string
  text?: string
  department?: string
  groupId?: string
  recipientIds?: string[]
  recipientNames?: string[]
  mentionedUserIds?: string[]
  mentionedNames?: string[]
}

export type CreateGroupPayload = {
  name: string
  department?: string
  description?: string
  memberIds?: string[]
}

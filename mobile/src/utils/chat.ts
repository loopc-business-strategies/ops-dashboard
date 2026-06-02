import type { ChatGroupRow, ChatMessage } from '@/src/api/messages'
import type { ChatAttachment, ChatConversation, ChatMessageRow, ChatParticipant } from '@/src/types/chat'

export function initialsFor(name: string) {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return String(parts[0] || 'U').slice(0, 2).toUpperCase()
}

export function participantColor(id = '') {
  const palette = ['#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#2563eb', '#059669']
  const sum = String(id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return palette[sum % palette.length]
}

export function participantFromRow(row: {
  _id?: string
  id?: string
  name?: string
  fullName?: string
  email?: string
  department?: string
  role?: string
  title?: string
  employeeCode?: string
}): ChatParticipant {
  const name = row.fullName || row.name || row.email || 'Team member'
  const id = String(row._id || row.id || name)
  return {
    id,
    name,
    email: row.email,
    dept: row.department || row.role,
    title: row.title || row.role,
    employeeCode: row.employeeCode,
    color: participantColor(id),
    initials: initialsFor(name),
  }
}

export function mentionKeysFor(person: ChatParticipant) {
  return Array.from(
    new Set(
      [person.name, person.email, person.employeeCode, person.name.split(/\s+/)[0]]
        .map((value) => String(value || '').trim().replace(/^@/, '').toLowerCase())
        .filter(Boolean),
    ),
  )
}

export function extractMentionParticipants(text: string, participants: ChatParticipant[]) {
  const handles = Array.from(
    new Set(
      Array.from(String(text).matchAll(/@([A-Za-z0-9._-]+)/g))
        .map((match) => String(match[1] || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  )
  if (!handles.length) return []
  return participants.filter((person) => {
    const keys = mentionKeysFor(person)
    return handles.some((handle) => keys.includes(handle))
  })
}

function senderKeyFromName(name: string) {
  const raw =
    String(name || 'member')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'member'
  return `name:${raw}`
}

export function buildConversations(
  apiMessages: ChatMessage[],
  participants: ChatParticipant[],
  myAuthId: string,
  existing: ChatConversation[] = [],
  serverGroups: ChatGroupRow[] = [],
): ChatConversation[] {
  const byId = new Map<string, ChatConversation>()

  const ensureChat = (chat: ChatConversation) => {
    if (!byId.has(chat.id)) {
      byId.set(chat.id, { ...chat, messages: chat.messages || [] })
    }
    return byId.get(chat.id)!
  }

  existing.forEach((chat) => {
    if (chat.isLocalOnly || !chat.messages.length) ensureChat(chat)
  })

  serverGroups.forEach((group) => {
    const groupId = String(group._id || '')
    if (!groupId) return
    ensureChat({
      id: `g:${groupId}`,
      groupId,
      room: group.room,
      type: 'group',
      name: group.name || group.room || 'Group',
      dept: group.department || 'All',
      members: Array.isArray(group.memberIds) ? group.memberIds.map(String) : [],
      unread: 0,
      muted: false,
      messages: [],
    })
  })

  participants.forEach((person) => {
    if (!person.id || person.id === myAuthId) return
    ensureChat({
      id: `d:${person.id}`,
      type: 'direct',
      name: person.name,
      otherId: person.id,
      unread: 0,
      muted: false,
      messages: [],
    })
  })

  const displayUser = (idOrName: string) => {
    const key = String(idOrName || '')
    const found = participants.find(
      (p) =>
        p.id === key ||
        p.name.toLowerCase() === key.toLowerCase() ||
        String(p.email || '').toLowerCase() === key.toLowerCase(),
    )
    return found || null
  }

  const sortedMessages = apiMessages.slice().sort((a, b) => {
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  })

  sortedMessages.forEach((m) => {
    const senderId = String(m.senderId || senderKeyFromName(m.senderName || ''))
    const recipientIds = Array.isArray(m.recipientIds) ? m.recipientIds.map(String) : []
    const isDirect = m.type === 'dm'
    const otherId = isDirect
      ? senderId === myAuthId
        ? recipientIds.find((id) => id !== myAuthId) || String(m.recipientNames?.[0] || 'direct')
        : senderId
      : ''
    const chatId = isDirect
      ? `d:${otherId}`
      : m.groupId
        ? `g:${m.groupId}`
        : `g:${m.room || m.department || 'Team'}`
    const other = isDirect ? displayUser(otherId) : null
    const chat = ensureChat({
      id: chatId,
      type: isDirect ? 'direct' : 'group',
      name: isDirect ? other?.name || String(m.recipientNames?.[0] || 'Direct Message') : m.room || 'Team',
      dept: m.department || 'All',
      groupId: m.groupId ? String(m.groupId) : undefined,
      room: m.room,
      otherId,
      members: Array.from(new Set([senderId, ...recipientIds].filter(Boolean))),
      unread: 0,
      muted: false,
      messages: [],
    })
    chat.members = Array.from(new Set([...(chat.members || []), senderId, ...recipientIds].filter(Boolean)))
    const row: ChatMessageRow = {
      id: String(m._id),
      from: senderId,
      text: String(m.text || m.message || ''),
      time: String(m.createdAt || new Date().toISOString()),
      isMine: senderId === myAuthId,
      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
    }
    if (!chat.messages.some((item) => item.id === row.id)) {
      chat.messages.push(row)
    }
  })

  return Array.from(byId.values()).sort((a, b) => {
    const at = new Date(a.messages[a.messages.length - 1]?.time || 0).getTime()
    const bt = new Date(b.messages[b.messages.length - 1]?.time || 0).getTime()
    return bt - at
  })
}

export function previewText(chat: ChatConversation) {
  const last = chat.messages[chat.messages.length - 1]
  if (!last) return chat.type === 'group' ? 'No messages yet' : 'Start a conversation'
  if (last.text) return last.text
  if (last.attachments?.length) {
    const first = last.attachments[0]
    if (first.kind === 'image') return 'Photo'
    return first.originalName || 'Attachment'
  }
  return '—'
}

export function formatAttachmentSize(size = 0) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

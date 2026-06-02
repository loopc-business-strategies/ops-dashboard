import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  createGroup as createGroupApi,
  createMessage,
  createMessageWithAttachment,
  fetchGroups,
  fetchLatestMessages,
  fetchParticipants,
} from '@/src/api/messages'
import { useAuth } from '@/src/context/AuthContext'
import type { ChatAttachment, ChatConversation, ChatParticipant } from '@/src/types/chat'
import { buildConversations, extractMentionParticipants, participantFromRow } from '@/src/utils/chat'

type ChatContextValue = {
  conversations: ChatConversation[]
  participants: ChatParticipant[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  getConversation: (id: string) => ChatConversation | undefined
  markRead: (id: string) => void
  sendMessage: (chatId: string, text: string) => Promise<void>
  sendAttachment: (chatId: string, file: { uri: string; name: string; mimeType?: string }) => Promise<void>
  createGroup: (input: { name: string; dept: string; memberIds: string[] }) => Promise<ChatConversation>
}

const ChatContext = createContext<ChatContextValue | null>(null)

function buildMessagePayload(
  chat: ChatConversation,
  userDept: string | undefined,
  myAuthId: string,
  text: string,
  participants: ChatParticipant[],
) {
  const mentioned = extractMentionParticipants(text, participants)
  const mentionedIds = mentioned.map((p) => p.id).filter(Boolean)
  const chatRecipientIds: string[] =
    chat.type === 'direct'
      ? [chat.otherId].filter((id): id is string => Boolean(id))
      : (chat.members || []).filter((id) => id !== myAuthId)
  const recipientIds = Array.from(new Set([...chatRecipientIds, ...mentionedIds]))

  return {
    type: chat.type === 'direct' ? ('dm' as const) : ('group' as const),
    room: chat.room || chat.name || 'All Departments',
    text: text.trim(),
    department: chat.dept || userDept || '',
    groupId: chat.groupId,
    recipientIds,
    recipientNames: chat.type === 'direct' ? [chat.name].filter(Boolean) : [],
    mentionedUserIds: mentionedIds,
    mentionedNames: mentioned.map((p) => p.name).filter(Boolean),
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const myAuthId = String(user?.id || '')
  const [participants, setParticipants] = useState<ChatParticipant[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!token || !myAuthId) return
    setError('')
    try {
      const [messagesRaw, participantsRaw, groupsRaw] = await Promise.all([
        fetchLatestMessages(token, 'all', 100),
        fetchParticipants(token),
        fetchGroups(token),
      ])
      const roster = participantsRaw.map(participantFromRow)
      setParticipants(roster)
      setConversations(buildConversations(messagesRaw, roster, myAuthId, [], groupsRaw))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }, [token, myAuthId])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    refresh()
    const interval = setInterval(() => {
      refresh().catch(() => undefined)
    }, 20000)
    return () => clearInterval(interval)
  }, [token, refresh])

  const getConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  )

  const markRead = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }, [])

  const sendMessage = useCallback(
    async (chatId: string, text: string) => {
      if (!token || !text.trim()) return
      const chat = conversations.find((c) => c.id === chatId)
      if (!chat) return

      const optimisticId = `local-${Date.now()}`
      const optimistic = {
        id: optimisticId,
        from: myAuthId,
        text: text.trim(),
        time: new Date().toISOString(),
        isMine: true,
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, messages: [...c.messages, optimistic], unread: 0 } : c,
        ),
      )

      try {
        const saved = await createMessage(
          token,
          buildMessagePayload(chat, user?.department, myAuthId, text, participants),
        )
        const savedId = String(saved.message?._id || '')
        const savedTime = String(saved.message?.createdAt || optimistic.time)
        if (savedId) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === optimisticId ? { ...m, id: savedId, time: savedTime } : m,
                    ),
                  }
                : c,
            ),
          )
        }
      } catch {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) }
              : c,
          ),
        )
        throw new Error('Message could not be sent')
      }
    },
    [token, conversations, myAuthId, participants, user?.department],
  )

  const sendAttachment = useCallback(
    async (chatId: string, file: { uri: string; name: string; mimeType?: string }) => {
      if (!token) return
      const chat = conversations.find((c) => c.id === chatId)
      if (!chat) return

      const optimisticId = `local-${Date.now()}`
      const optimisticAttachment: ChatAttachment = {
        fileName: file.name,
        originalName: file.name,
        mimeType: file.mimeType,
        kind: file.mimeType?.startsWith('image/') ? 'image' : 'file',
      }
      const optimistic = {
        id: optimisticId,
        from: myAuthId,
        text: '',
        time: new Date().toISOString(),
        isMine: true,
        attachments: [optimisticAttachment],
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, messages: [...c.messages, optimistic], unread: 0 } : c,
        ),
      )

      const payload = buildMessagePayload(chat, user?.department, myAuthId, '', participants)
      const formData = new FormData()
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as unknown as Blob)
      formData.append('type', payload.type)
      formData.append('room', payload.room || '')
      formData.append('department', payload.department || '')
      if (payload.groupId) formData.append('groupId', payload.groupId)
      if (payload.recipientIds?.length) {
        formData.append('recipientIds', JSON.stringify(payload.recipientIds))
      }
      if (payload.recipientNames?.length) {
        formData.append('recipientNames', JSON.stringify(payload.recipientNames))
      }

      try {
        const saved = await createMessageWithAttachment(token, formData)
        const savedId = String(saved.message?._id || '')
        const savedTime = String(saved.message?.createdAt || optimistic.time)
        const savedAttachments = saved.message?.attachments
        if (savedId) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === optimisticId
                        ? {
                            ...m,
                            id: savedId,
                            time: savedTime,
                            attachments: savedAttachments || m.attachments,
                          }
                        : m,
                    ),
                  }
                : c,
            ),
          )
        }
      } catch {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) }
              : c,
          ),
        )
        throw new Error('Attachment could not be sent')
      }
    },
    [token, conversations, myAuthId, participants, user?.department],
  )

  const createGroup = useCallback(
    async (input: { name: string; dept: string; memberIds: string[] }) => {
      if (!token) throw new Error('Not signed in')
      const memberIds = Array.from(new Set([myAuthId, ...input.memberIds].filter(Boolean)))
      const saved = await createGroupApi(token, {
        name: input.name.trim(),
        department: input.dept.trim() || user?.department || 'All',
        memberIds,
      })
      const group = saved.group
      if (!group?._id) throw new Error('Group could not be created')

      const conversation: ChatConversation = {
        id: `g:${group._id}`,
        groupId: String(group._id),
        room: group.room,
        type: 'group',
        name: group.name || input.name.trim(),
        dept: group.department || input.dept,
        members: (group.memberIds || memberIds).map(String),
        unread: 0,
        muted: false,
        messages: [],
      }
      setConversations((prev) => [conversation, ...prev.filter((c) => c.id !== conversation.id)])
      return conversation
    },
    [token, myAuthId, user?.department],
  )

  const value = useMemo(
    () => ({
      conversations,
      participants,
      loading,
      error,
      refresh,
      getConversation,
      markRead,
      sendMessage,
      sendAttachment,
      createGroup,
    }),
    [
      conversations,
      participants,
      loading,
      error,
      refresh,
      getConversation,
      markRead,
      sendMessage,
      sendAttachment,
      createGroup,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

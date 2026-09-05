// FILE: src/components/tabs/ChatTab.jsx
// Chat — stateful shell (SSE/hooks eager); presentational modules extracted

import { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { useAuth }        from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../context/LanguageContext'
import messagesAPI from '../../api/messages'
import { getTenantBranding } from '../../config/tenantBranding'
import { detectTextDirection, isRtlChatLang, isSameTranslation } from '../../utils/chatTranslate'
import { subscribeRealtimeEvents } from '../../utils/realtimeEventsBus'
import { countOnlineMembers as countOnlineMemberIds, createOnlineLookup } from '../../utils/chatPresence'
import useOnlineUserIds from '../../hooks/useOnlineUserIds'
import { C } from './chat/chatUi'
import ChatSidebar from './chat/ChatSidebar'
import ChatThread from './chat/ChatThread'
import {
  GROUP_MODULES,
  defaultGroupForm,
} from './chat/chatGroupConstants'

const ChatGroupModal = lazy(() => import('./chat/ChatGroupModal'))

const USE_SEED_DATA =
  !import.meta.env.PROD
  && import.meta.env.DEV
  && String(import.meta.env.VITE_ENABLE_SEED_DATA || '').toLowerCase() === 'true'

function senderKeyFromName(name) {
  const raw = String(name || 'member')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'member'
  return `name:${raw}`
}

// ─────────────────────────────────────────────────────────
// Optional demo roster / chats (VITE_ENABLE_SEED_DATA=true in dev only)
// ─────────────────────────────────────────────────────────
const SEED_USERS = USE_SEED_DATA ? [
  { id: 'sa',       name: 'Admin',        dept: 'Admin',      color: 'var(--purple)', initials: 'SA' },
  { id: 'ali',      name: 'Ali Hassan',   dept: 'Production', color: '#60a5fa', initials: 'AH' },
  { id: 'sara',     name: 'Sara Ahmed',   dept: 'Compliance', color: '#c084fc', initials: 'SA' },
  { id: 'fatima',   name: 'Fatima Noor',  dept: 'HR',         color: '#2dd4bf', initials: 'FN' },
  { id: 'omar',     name: 'Omar Khan',    dept: 'Operations', color: '#fbbf24', initials: 'OK' },
  { id: 'investor', name: 'Mr. Investor', dept: 'Management', color: '#94a3b8', initials: 'MI' },
] : []

const T = Date.now()
const INITIAL_CHATS = USE_SEED_DATA ? [
  {
    id: 'g1', type: 'group', name: 'All Departments', dept: 'All',
    members: ['sa','ali','sara','fatima','omar'], unread: 2, muted: false,
    messages: [
      { id:'m1', from:'ali',    text:'Machine installation update: Crusher Unit A is now fully operational ✅', time: new Date(T - 90*60000).toISOString(),  file: null },
      { id:'m2', from:'fatima', text:'3 new hires onboarded today. Orientation session starts tomorrow morning.', time: new Date(T - 75*60000).toISOString(), file: null },
      { id:'m3', from:'sa',     text:'Great progress team! Keep the activity logs updated on the dashboard.', time: new Date(T - 70*60000).toISOString(),    file: null },
      { id:'m4', from:'sara',   text:'Ministry requested additional documents for eligibility. Working on it.', time: new Date(T - 20*60000).toISOString(),   file: null },
    ],
  },
  {
    id: 'g2', type: 'group', name: 'Production Team', dept: 'Production',
    members: ['sa','ali','omar'], unread: 1, muted: false,
    messages: [
      { id:'m5', from:'ali',  text:"Conveyor belt is stuck in customs — Almaty port.",                        time: new Date(T - 26*3600000).toISOString(), file: null },
      { id:'m6', from:'sa',   text:"Escalate immediately. I'll contact the logistics agent today.",           time: new Date(T - 25*3600000).toISOString(), file: null },
      { id:'m7', from:'omar', text:"Here's the customs clearance document they're requesting",                time: new Date(T - 24*3600000).toISOString(), file: { name:'customs_clearance.pdf', size:'245 KB', ext:'pdf' } },
    ],
  },
  {
    id: 'd1', type: 'direct', name: 'Ali Hassan', otherId: 'ali',
    unread: 0, muted: false,
    messages: [
      { id:'m8',  from:'sa',  text:'Ali, how is the installation progress on the conveyor belt?',                    time: new Date(T - 4*3600000).toISOString(),   file: null },
      { id:'m9',  from:'ali', text:"It's delayed due to customs. I've filed the paperwork. Should arrive in ~10 days.", time: new Date(T - 3.9*3600000).toISOString(), file: null },
      { id:'m10', from:'ali', text:"I'll send you the updated logistics report",                                      time: new Date(T - 3.8*3600000).toISOString(), file: { name:'logistics_report_apr.docx', size:'128 KB', ext:'docx' } },
    ],
  },
  {
    id: 'd2', type: 'direct', name: 'Sara Ahmed', otherId: 'sara',
    unread: 2, muted: false,
    messages: [
      { id:'m11', from:'sara', text:'The eligibility criteria approval is taking longer than expected.',         time: new Date(T - 3*3600000).toISOString(),   file: null },
      { id:'m12', from:'sara', text:"I've attached the ministry correspondence for your review.",                time: new Date(T - 2.9*3600000).toISOString(), file: { name:'ministry_letter_apr10.pdf', size:'312 KB', ext:'pdf' } },
    ],
  },
  {
    id: 'd3', type: 'direct', name: 'Fatima Noor', otherId: 'fatima',
    unread: 0, muted: false,
    messages: [
      { id:'m13', from:'fatima', text:'HR update: Visa for 2 foreign specialists is still pending.',   time: new Date(T - 28*3600000).toISOString(), file: null },
      { id:'m14', from:'sa',     text:'Keep following up. We need them on site by June.',              time: new Date(T - 27.5*3600000).toISOString(), file: null },
    ],
  },
  {
    id: 'd4', type: 'direct', name: 'Mr. Investor', otherId: 'investor',
    unread: 0, muted: true,
    messages: [
      { id:'m15', from:'investor', text:'Can you share the latest project health report?',                              time: new Date(T - 3*86400000).toISOString(), file: null },
      { id:'m16', from:'sa',       text:"Of course — dashboard access has been updated. You can view all reports.",     time: new Date(T - 3*86400000 + 600000).toISOString(), file: null },
    ],
  },
] : []

const AUTO_REPLIES = [
  "Got it, thanks! I'll update the dashboard shortly.",
  "Understood. Will confirm and keep you posted.",
  "On it! Will send you the details by end of day.",
  "Thanks for the heads up. Looking into it now.",
  "Confirmed — will action this now.",
  "Received. Let me check with the team and get back to you.",
]

function getUser(id) {
  const seeded = SEED_USERS.find((u) => u.id === id)
  if (seeded) return seeded
  if (String(id).startsWith('name:')) {
    const slug = String(id).slice(5)
    const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || 'Team member'
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'TM'
    return { id, name, dept: '', color: '#64748b', initials }
  }
  return { id: String(id), name: 'Team member', dept: '', color: '#64748b', initials: 'TM' }
}

function ChatTab({ onUnreadChange, onBack, openChatId = null, onOpenChatIdConsumed, focusComposerNonce = 0 }) {
  const { user, token, company }  = useAuth()
  const perms     = usePermissions()
  const { t } = useLanguage()
  const onlineUserIds = useOnlineUserIds()
  const chatTranslateEnabled = Boolean(getTenantBranding(user?.company || company)?.featureFlags?.chatTranslate)

  const [chats,         setChats]         = useState(INITIAL_CHATS)
  const [activeChatId,  setActiveChatId]  = useState(null)
  const chatsRef = useRef(chats)
  useEffect(() => {
    chatsRef.current = chats
  }, [chats])
  const [search,        setSearch]        = useState('')
  const [msgText,       setMsgText]       = useState('')
  const [translateTargetLang, setTranslateTargetLang] = useState('en')
  const [translateSourceLang, setTranslateSourceLang] = useState('auto')
  const [translatePreview, setTranslatePreview] = useState('')
  const [translateOriginal, setTranslateOriginal] = useState('')
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translatePanelOpen, setTranslatePanelOpen] = useState(false)

  const composerTextDirection = useMemo(() => detectTextDirection(msgText), [msgText])
  const previewTargetRtl = isRtlChatLang(translateTargetLang)
  const originalTextDirection = useMemo(() => detectTextDirection(translateOriginal), [translateOriginal])
  const [showGroupModal,setShowGroupModal]= useState(false)
  const [typingChatId,  setTypingChatId]  = useState(null)
  const [toast,         setToast]         = useState(null)
  const [groupForm,     setGroupForm]     = useState(defaultGroupForm)
  const [groupMemberSearch, setGroupMemberSearch] = useState('')
  const [participants,  setParticipants]  = useState([])

  const isUserOnline = useMemo(
    () => createOnlineLookup(onlineUserIds, participants),
    [onlineUserIds, participants],
  )

  const countOnlineMembers = (memberIds = []) => countOnlineMemberIds(memberIds, isUserOnline)

  const messagesEndRef   = useRef(null)
  const inputRef         = useRef(null)
  const fileInputRef     = useRef(null)
  const activeChatIdRef  = useRef(activeChatId)
  const latestSeenRef    = useRef('')
  const participantsRef  = useRef([])
  /** Tracks deep-link retries when `openChatId` is not yet in `chats` (e.g. list still loading). */
  const pendingDeepLinkChatRef = useRef({ id: null, attempts: 0 })
  useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])
  useEffect(() => { participantsRef.current = participants }, [participants])

  // unread badge for sidebar
  useEffect(() => {
    const n = chats.reduce((s,c) => s + (c.muted ? 0 : c.unread), 0)
    onUnreadChange?.(n)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent onUnreadChange is often an inline; badge only tracks chats
  }, [chats])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [activeChatId, chats])
  useEffect(() => { if (activeChatId) setTimeout(() => inputRef.current?.focus(), 60) }, [activeChatId])

  /** Bell / deep-link: focus composer after Chat tab is visible (nonce from Dashboard). */
  useEffect(() => {
    if (!focusComposerNonce) return undefined
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 140)
    return () => window.clearTimeout(id)
  }, [focusComposerNonce])

  const myAuthId = String(user?._id || user?.id || 'me')
  const myAuthIdRef = useRef(myAuthId)
  useEffect(() => {
    myAuthIdRef.current = myAuthId
  }, [myAuthId])

  const myId = USE_SEED_DATA
    ? (() => {
        if (perms.isSuperAdmin) return 'sa'
        if (perms.isManagement) return 'investor'
        if (perms.isDepartmentHead) {
          const d = user?.department
          if (d === 'production') return 'ali'
          if (d === 'government') return 'sara'
          if (d === 'hr') return 'fatima'
          return 'ali'
        }
        return 'omar'
      })()
    : myAuthId

  const senderToSeedId = (senderName = '') => {
    const byName = SEED_USERS.find((u) => u.name.toLowerCase() === String(senderName).toLowerCase())
    if (byName) return byName.id
    if ((user?.name || '').toLowerCase() === String(senderName).toLowerCase()) return myId
    if (USE_SEED_DATA) return 'sa'
    return senderKeyFromName(senderName)
  }

  const initialsFor = (name = '') => {
    const initials = String(name || 'User')
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return initials || 'U'
  }

  const participantColor = (id = '') => {
    const palette = ['#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#2563eb', '#059669']
    const sum = String(id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return palette[sum % palette.length]
  }

  const participantToUser = (row) => {
    const name = row?.fullName || row?.name || row?.email || 'Team member'
    return {
      id: String(row?._id || row?.id || name),
      name,
      email: row?.email || '',
      dept: row?.department || row?.role || '',
      title: row?.title || row?.role || '',
      employeeCode: row?.employeeCode || '',
      color: participantColor(row?._id || name),
      initials: initialsFor(name),
    }
  }

  const displayUser = (idOrName) => {
    const key = String(idOrName || '')
    const found = participantsRef.current.find((p) => (
      String(p._id) === key
      || String(p.id) === key
      || String(p.name || '').toLowerCase() === key.toLowerCase()
      || String(p.fullName || '').toLowerCase() === key.toLowerCase()
      || String(p.email || '').toLowerCase() === key.toLowerCase()
    ))
    return found ? participantToUser(found) : getUser(idOrName)
  }

  const mentionKeysFor = (person) => Array.from(new Set([
    person?.name,
    person?.fullName,
    person?.employeeCode,
    person?.email,
    String(person?.name || '').split(/\s+/)[0],
    String(person?.fullName || '').split(/\s+/)[0],
  ]
    .map((value) => String(value || '').trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean)))

  const extractMentionParticipants = (text) => {
    const handles = Array.from(new Set(
      Array.from(String(text || '').matchAll(/@([A-Za-z0-9._-]+)/g))
        .map((match) => String(match[1] || '').trim().toLowerCase())
        .filter(Boolean)
    ))
    if (!handles.length) return []
    return participantsRef.current.filter((person) => {
      const keys = mentionKeysFor(person)
      return handles.some((handle) => keys.includes(handle))
    })
  }

  const formatAttachmentSize = (size = 0) => {
    if (!size) return ''
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const attachmentToFile = (attachment) => {
    if (!attachment?.fileName) return null
    const name = attachment.originalName || attachment.fileName
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : (attachment.kind === 'image' ? 'img' : 'file')
    return {
      name,
      size: formatAttachmentSize(attachment.size),
      ext,
      url: messagesAPI.attachmentUrl(attachment.fileName),
      previewUrl: attachment.kind === 'image' ? messagesAPI.attachmentUrl(attachment.fileName) : null,
    }
  }

  const messagePayloadForChat = (currentChat, text) => {
    const mentioned = extractMentionParticipants(text)
    const mentionedIds = mentioned.map((person) => String(person._id || person.id)).filter(Boolean)
    const chatRecipientIds = currentChat?.type === 'direct'
      ? [currentChat?.otherId].filter(Boolean)
      : (currentChat?.members || []).filter((id) => String(id) !== myAuthId)
    const recipientIds = Array.from(new Set([...chatRecipientIds, ...mentionedIds].filter(Boolean)))
    return {
      type: currentChat?.type === 'direct' ? 'dm' : 'group',
      room: currentChat?.room || currentChat?.name || 'All Departments',
      text,
      department: currentChat?.dept || user?.department || '',
      groupId: currentChat?.groupId,
      recipientIds,
      recipientNames: currentChat?.type === 'direct' ? [currentChat?.name].filter(Boolean) : [],
      mentionedUserIds: mentionedIds,
      mentionedNames: mentioned.map((person) => person.name || person.fullName).filter(Boolean),
    }
  }

  useEffect(() => {
    if (!token) return
    messagesAPI.getParticipants(token)
      .then((data) => setParticipants(Array.isArray(data.users) ? data.users : []))
      .catch(() => setParticipants([]))
  }, [token])

  useEffect(() => {
    if (!participants.length) return
    setChats((prev) => {
      const existing = new Set(prev.map((chat) => chat.id))
      const directShells = participants
        .map(participantToUser)
        .filter((person) => person.id && person.id !== myAuthId && person.id !== myId && !existing.has(`d:${person.id}`))
        .map((person) => ({
          id: `d:${person.id}`,
          type: 'direct',
          name: person.name,
          otherId: person.id,
          unread: 0,
          muted: false,
          messages: [],
        }))
      return directShells.length ? [...prev, ...directShells] : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length])

  async function loadLatestFromApi(showIncomingToast = false) {
    if (!token) return
    try {
      const [data, groupsData] = await Promise.all([
        messagesAPI.getLatestMessages(token, 'all', 100),
        messagesAPI.getGroups(token).catch(() => ({ groups: [] })),
      ])
      const messages = (data.messages || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      const serverGroups = Array.isArray(groupsData.groups) ? groupsData.groups : []
      const latestId = messages[messages.length - 1]?._id || ''
      const hasNew = latestSeenRef.current && latestSeenRef.current !== latestId
      if (latestId) latestSeenRef.current = latestId

      setChats((prev) => {
        const byId = new Map()
        const ensureChat = (chat) => {
          if (!byId.has(chat.id)) byId.set(chat.id, { ...chat, messages: chat.messages || [] })
          return byId.get(chat.id)
        }

        prev.forEach((chat) => {
          if (chat.messages?.length) return
          ensureChat(chat)
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

        participantsRef.current.forEach((person) => {
          const id = String(person._id || person.id || '')
          if (!id || id === myAuthId) return
          const p = participantToUser(person)
          ensureChat({ id: `d:${id}`, type: 'direct', name: p.name, otherId: id, unread: 0, muted: false, messages: [] })
        })

        messages.forEach((m) => {
          const senderId = String(m.senderId || senderToSeedId(m.senderName))
          const recipientIds = Array.isArray(m.recipientIds) ? m.recipientIds.map(String) : []
          const isDirect = m.type === 'dm'
          const otherId = isDirect
            ? (senderId === myAuthId ? (recipientIds.find((id) => id !== myAuthId) || String(m.recipientNames?.[0] || 'direct')) : senderId)
            : ''
          const chatId = isDirect
            ? `d:${otherId}`
            : (m.groupId ? `g:${m.groupId}` : `g:${m.room || m.department || 'Team'}`)
          const other = isDirect ? displayUser(otherId) : null
          const chat = ensureChat({
            id: chatId,
            type: isDirect ? 'direct' : 'group',
            name: isDirect ? (other?.name || String(m.recipientNames?.[0] || 'Direct Message')) : (m.room || 'Team'),
            dept: m.department || 'All',
            groupId: m.groupId ? String(m.groupId) : undefined,
            room: m.room,
            otherId,
            members: Array.from(new Set([senderId, ...recipientIds].filter(Boolean))),
            unread: 0,
            muted: false,
            messages: [],
          })
          if (!chat.members) chat.members = []
          chat.members = Array.from(new Set([...chat.members, senderId, ...recipientIds].filter(Boolean)))
          if (!chat.messages.some((row) => row.id === String(m._id))) {
            const attachment = Array.isArray(m.attachments) && m.attachments[0] ? attachmentToFile(m.attachments[0]) : null
            chat.messages.push({
              id: String(m._id),
              from: senderId,
              text: m.text,
              time: m.createdAt,
              file: attachment,
            })
          }
        })

        return Array.from(byId.values()).sort((a, b) => {
          const at = new Date(a.messages[a.messages.length - 1]?.time || 0).getTime()
          const bt = new Date(b.messages[b.messages.length - 1]?.time || 0).getTime()
          return bt - at
        })
      })

      if (showIncomingToast && hasNew) {
        const m = messages[messages.length - 1]
        const senderKey = String(m.senderId != null ? m.senderId : '').trim()
        const fromSelf = senderKey && senderKey === String(myAuthIdRef.current || '').trim()
        // Others get the bell notification; avoid duplicating an in-tab toast for your own send.
        if (!fromSelf) {
          const sender = displayUser(m.senderId || senderToSeedId(m.senderName))
          showToast(`New message from ${sender?.name || 'Team'}`, m.text || 'New message', sender?.color || C.accent)
        }
      }
    } catch {
      // Keep local fallback if API is unavailable.
    }
  }

  useEffect(() => {
    if (!token) return undefined
    loadLatestFromApi(false)

    const tenant = user?.company || user?.tenant?.key || user?.tenant?.name
    const onMessageCreated = () => { loadLatestFromApi(true) }
    const unsub = subscribeRealtimeEvents(tenant, 'message.created', onMessageCreated)

    const fallbackId = window.setInterval(() => { loadLatestFromApi(false) }, 60000)

    return () => {
      unsub()
      window.clearInterval(fallbackId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.company, user?.tenant])

  const canCreateGroup = perms.isSuperAdmin || perms.isDepartmentHead
  const activeChat     = chats.find(c => c.id === activeChatId)
  const activeDmOnline = activeChat?.type === 'direct' ? isUserOnline(activeChat.otherId) : false
  const activeGroupOnlineCount = activeChat?.type === 'group' ? countOnlineMembers(activeChat.members) : 0

  function clearTranslateResult() {
    setTranslatePreview('')
    setTranslateOriginal('')
    setTranslateLoading(false)
  }

  function resetTranslateState() {
    clearTranslateResult()
    setTranslatePanelOpen(false)
  }

  function openChat(id) {
    setActiveChatId(id)
    setMsgText('')
    resetTranslateState()
    setChats(prev => prev.map(c => c.id === id ? { ...c, unread:0 } : c))
  }

  useEffect(() => {
    if (!openChatId || typeof onOpenChatIdConsumed !== 'function') {
      pendingDeepLinkChatRef.current = { id: null, attempts: 0 }
      return undefined
    }

    if (chats.some((c) => c.id === openChatId)) {
      setActiveChatId(openChatId)
      setMsgText('')
      resetTranslateState()
      setChats((prev) => prev.map((c) => (c.id === openChatId ? { ...c, unread: 0 } : c)))
      pendingDeepLinkChatRef.current = { id: null, attempts: 0 }
      onOpenChatIdConsumed()
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 80)
      return undefined
    }

    if (pendingDeepLinkChatRef.current.id !== openChatId) {
      pendingDeepLinkChatRef.current = { id: openChatId, attempts: 0 }
      void loadLatestFromApi(false)
    }

    if (pendingDeepLinkChatRef.current.attempts >= 40) {
      pendingDeepLinkChatRef.current = { id: null, attempts: 0 }
      onOpenChatIdConsumed()
      return undefined
    }

    const timer = window.setTimeout(() => {
      pendingDeepLinkChatRef.current.attempts += 1
      void loadLatestFromApi(false)
    }, 120)

    return () => window.clearTimeout(timer)
    // loadLatestFromApi is intentionally stable for this effect's polling behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatId, chats, onOpenChatIdConsumed])

  function showToast(title, text, color = C.accent) {
    setToast({ title, text, color })
    setTimeout(() => setToast(null), 3200)
  }

  async function handleTranslateMessage() {
    const text = msgText.trim()
    if (!text || translateLoading) return
    setTranslateLoading(true)
    try {
      const result = await messagesAPI.translateMessage(token, {
        text,
        targetLang: translateTargetLang,
        sourceLang: translateSourceLang,
      })
      const translated = String(result?.translatedText || '').trim()
      if (!result?.success || !translated) {
        throw new Error(result?.message || t('chatTranslateFailed'))
      }
      if (result?.sameLanguage || isSameTranslation(text, translated)) {
        clearTranslateResult()
        showToast(t('chatTranslatePreview'), t('chatTranslateSameLanguage'), '#0f766e')
        return
      }
      setTranslateOriginal(text)
      setTranslatePreview(translated)
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || t('chatTranslateFailed')
      showToast(t('chatTranslateFailed'), serverMsg, '#DC2626')
    } finally {
      setTranslateLoading(false)
    }
  }

  function handleTranslateTargetChange(nextLang) {
    setTranslateTargetLang(nextLang)
    clearTranslateResult()
  }

  function handleTranslateSourceChange(nextLang) {
    setTranslateSourceLang(nextLang)
    clearTranslateResult()
  }

  function handleUseTranslation() {
    const next = translatePreview.trim()
    if (!next) return
    setMsgText(next)
    resetTranslateState()
  }

  function handleRevertTranslation() {
    if (translateOriginal) setMsgText(translateOriginal)
    resetTranslateState()
  }

  async function sendMessage(chatId) {
    const text = msgText.trim()
    if (!text || !chatId) return
    const newMsg = { id:`m${Date.now()}`, from:myId, text, time:new Date().toISOString(), file:null, pending: true }
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages:[...c.messages, newMsg] } : c))
    setMsgText('')
    resetTranslateState()
    const currentChat = chatsRef.current.find(c => c.id === chatId)
    if (!currentChat) {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== newMsg.id) } : c)))
      setMsgText(text)
      showToast('Send failed', 'Conversation is still loading. Please try again.', '#DC2626')
      return
    }
    const payload = messagePayloadForChat(currentChat, text)
    try {
      const saved = await messagesAPI.createMessage(token, payload)
      if (saved?.message?._id) {
        setChats(prev => prev.map(c => c.id === chatId ? {
          ...c,
          messages: c.messages.map(m => m.id === newMsg.id ? {
            ...m,
            id: String(saved.message._id),
            time: saved.message.createdAt || m.time,
            pending: false,
          } : m),
        } : c))
      } else {
        setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== newMsg.id) } : c)))
        setMsgText(text)
        const why = typeof saved?.message === 'string'
          ? saved.message
          : (typeof saved?.message === 'object' && saved?.message && !saved.message._id
            ? (saved.message.message || 'Server did not confirm the message.')
            : 'Unexpected response from server.')
        showToast('Send failed', why, '#DC2626')
      }
      if (payload.mentionedUserIds?.length) {
        showToast('Mention sent', `Delivered to ${payload.mentionedUserIds.length} mentioned user${payload.mentionedUserIds.length === 1 ? '' : 's'}.`)
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Message could not be delivered. Please try again.'
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter(m => m.id !== newMsg.id) } : c))
      setMsgText(text)
      showToast('Send failed', serverMsg, '#DC2626')
    }
    if (!USE_SEED_DATA) return
    const chat = chats.find(c => c.id === chatId)
    if (chat?.type !== 'direct') return
    const otherId = chat.otherId
    const other   = displayUser(otherId)
    setTypingChatId(chatId)
    const delay = 1200 + Math.random() * 900
    setTimeout(() => {
      setTypingChatId(null)
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)]
      const replyMsg = { id:`m${Date.now()}r`, from:otherId, text:reply, time:new Date().toISOString(), file:null }
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c
        const isActive = activeChatIdRef.current === chatId
        return { ...c, messages:[...c.messages, replyMsg], unread: isActive ? 0 : c.unread + 1 }
      }))
      if (activeChatIdRef.current !== chatId) {
        showToast('💬 ' + (other?.name || chat.name), reply, other?.color)
      }
    }, delay)
  }

  function triggerFilePick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !activeChatId) return

    const caption = msgText.trim()
    const currentChat = chatsRef.current.find((c) => c.id === activeChatId)
    const optimisticId = `m${Date.now()}`
    const optimisticFile = {
      name: file.name,
      size: formatAttachmentSize(file.size),
      ext: file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : 'file',
    }
    const newMsg = { id: optimisticId, from: myId, text: caption, time: new Date().toISOString(), file: optimisticFile, pending: true }
    setChats((prev) => prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, newMsg] } : c)))

    if (!currentChat) {
      setChats((prev) => prev.map((c) => (c.id === activeChatId ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) } : c)))
      showToast('Upload failed', 'Conversation is still loading. Please try again.', '#DC2626')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    const payload = messagePayloadForChat(currentChat, caption)
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      if (Array.isArray(value)) formData.append(key, JSON.stringify(value))
      else formData.append(key, String(value))
    })

    try {
      const saved = await messagesAPI.createMessageWithAttachment(token, formData)
      const attachment = Array.isArray(saved?.message?.attachments) && saved.message.attachments[0]
        ? attachmentToFile(saved.message.attachments[0])
        : optimisticFile
      if (saved?.message?._id) {
        setChats((prev) => prev.map((c) => (c.id === activeChatId ? {
          ...c,
          messages: c.messages.map((m) => (
            m.id === optimisticId
              ? { ...m, id: String(saved.message._id), time: saved.message.createdAt || m.time, file: attachment, pending: false }
              : m
          )),
        } : c)))
        setMsgText('')
        resetTranslateState()
        showToast('📎 File sent', file.name)
      } else {
        setChats((prev) => prev.map((c) => (
          c.id === activeChatId ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) } : c
        )))
        const why = saved?.message || 'Unexpected response from server.'
        showToast('Upload failed', typeof why === 'string' ? why : 'Attachment could not be sent.', '#DC2626')
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Attachment could not be sent.'
      setChats((prev) => prev.map((c) => (
        c.id === activeChatId ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) } : c
      )))
      showToast('Upload failed', serverMsg, '#DC2626')
    }
  }

  async function createGroup() {
    if (!groupForm.name.trim()) return
    try {
      const memberIds = groupForm.members.filter(Boolean)
      const saved = await messagesAPI.createGroup(token, {
        name: groupForm.name.trim(),
        department: groupForm.dept,
        description: groupForm.description,
        memberIds,
      })
      const group = saved?.group
      if (!group?._id) throw new Error('Group not created')
      const g = {
        id: `g:${group._id}`,
        groupId: String(group._id),
        room: group.room,
        type: 'group',
        name: group.name || groupForm.name.trim(),
        dept: group.department || groupForm.dept,
        description: group.description || groupForm.description,
        members: (group.memberIds || memberIds).map(String),
        unread: 0,
        muted: false,
        messages: [],
      }
      setChats((prev) => [g, ...prev.filter((chat) => chat.id !== g.id)])
      setGroupForm(defaultGroupForm())
      setGroupMemberSearch('')
      setShowGroupModal(false)
      setTimeout(() => openChat(g.id), 80)
      showToast('✅ Group Created', g.name + ' is ready to use')
    } catch (err) {
      showToast('Group failed', err?.response?.data?.message || err?.message || 'Could not create group.', '#DC2626')
    }
  }

  const q            = search.toLowerCase()
  const filtered     = chats.filter(c => c.name.toLowerCase().includes(q))
  const groupChats   = filtered.filter(c => c.type === 'group')
  const directChats  = filtered.filter(c => c.type === 'direct')
  const groupPeople = (participants.length ? participants.map(participantToUser) : SEED_USERS)
    .filter(u => u.id !== myId && u.id !== myAuthId)
  const memberQuery = groupMemberSearch.trim().toLowerCase()
  const filteredGroupPeople = groupPeople.filter((person) => (
    !memberQuery
    || person.name.toLowerCase().includes(memberQuery)
    || String(person.email || '').toLowerCase().includes(memberQuery)
    || String(person.dept || '').toLowerCase().includes(memberQuery)
    || String(person.title || '').toLowerCase().includes(memberQuery)
  ))
  const enabledPermissionCount = GROUP_MODULES.filter((item) => groupForm.permissions?.[item.key]).length
  const groupModalInputStyle = {
    width:'100%',
    background:'#fff',
    border:'1px solid #DDE5EE',
    borderRadius:10,
    padding:'12px 14px',
    fontSize:13,
    color:'#0F172A',
    fontFamily:'inherit',
    outline:'none',
    boxSizing:'border-box',
  }

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'calc(100vh - 68px)', margin:'-24px', fontFamily:"'Inter', sans-serif" }}>
      <ChatSidebar
        onBack={onBack}
        t={t}
        canCreateGroup={canCreateGroup}
        showToast={showToast}
        setShowGroupModal={setShowGroupModal}
        search={search}
        setSearch={setSearch}
        groupChats={groupChats}
        directChats={directChats}
        activeChatId={activeChatId}
        openChat={openChat}
        displayUser={displayUser}
      />
      <ChatThread
        t={t}
        activeChat={activeChat}
        activeChatId={activeChatId}
        activeDmOnline={activeDmOnline}
        activeGroupOnlineCount={activeGroupOnlineCount}
        displayUser={displayUser}
        myId={myId}
        showToast={showToast}
        msgText={msgText}
        setMsgText={setMsgText}
        sendMessage={sendMessage}
        triggerFilePick={triggerFilePick}
        fileInputRef={fileInputRef}
        handleFileSelected={handleFileSelected}
        messagesEndRef={messagesEndRef}
        inputRef={inputRef}
        typingChatId={typingChatId}
        chatTranslateEnabled={chatTranslateEnabled}
        translatePanelOpen={translatePanelOpen}
        setTranslatePanelOpen={setTranslatePanelOpen}
        translateSourceLang={translateSourceLang}
        handleTranslateSourceChange={handleTranslateSourceChange}
        translateTargetLang={translateTargetLang}
        handleTranslateTargetChange={handleTranslateTargetChange}
        handleTranslateMessage={handleTranslateMessage}
        translateLoading={translateLoading}
        translatePreview={translatePreview}
        translateOriginal={translateOriginal}
        handleUseTranslation={handleUseTranslation}
        handleRevertTranslation={handleRevertTranslation}
        resetTranslateState={resetTranslateState}
        clearTranslateResult={clearTranslateResult}
        composerTextDirection={composerTextDirection}
        originalTextDirection={originalTextDirection}
        previewTargetRtl={previewTargetRtl}
      />
      {showGroupModal && (
        <Suspense fallback={null}>
          <ChatGroupModal
            t={t}
            groupForm={groupForm}
            setGroupForm={setGroupForm}
            groupMemberSearch={groupMemberSearch}
            setGroupMemberSearch={setGroupMemberSearch}
            filteredGroupPeople={filteredGroupPeople}
            enabledPermissionCount={enabledPermissionCount}
            groupModalInputStyle={groupModalInputStyle}
            setShowGroupModal={setShowGroupModal}
            createGroup={createGroup}
          />
        </Suspense>
      )}
      {toast && (
        <div style={{ position:'fixed', top:14, right:14, minWidth:250, background:'#ffffff', border:`1px solid ${C.border}`, borderLeft:`3px solid ${toast.color || C.accent}`, borderRadius:12, padding:'12px 16px', zIndex:999, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', animation:'toastIn .3s ease' }}>
          <style>{`@keyframes toastIn{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
          <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1c2a33', marginBottom:3 }}>{toast.title}</div>
              <div style={{ fontSize:12, color:'#334155' }}>{toast.text}</div>
            </div>
            <button onClick={() => setToast(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#334155', fontSize:16, lineHeight:1 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatTab

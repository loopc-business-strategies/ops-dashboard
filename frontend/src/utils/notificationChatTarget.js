/**
 * Resolves ChatTab row id (`d:userId` / `g:groupId` / `g:room…`) from Socket.IO notification payloads.
 * Must stay aligned with `ChatTab` message → chat row id mapping.
 */
export function resolveChatTargetIdFromSocketPayload(payload) {
  const type = String(payload?.type || '')
  const data = payload?.data || {}
  if (type !== 'chat_message' && type !== 'chat_mention') return null

  const ch = String(data.channelType || '').toLowerCase()
  const isDm = ch === 'dm' || ch === 'direct'
  const isGroup = ch === 'group' || ch === 'channel'

  const senderId = String(data.senderId || '').trim()
  const groupId = String(data.groupId || '').trim()
  const room = String(data.room || '').trim()
  const department = String(data.department || '').trim()

  if (isDm) {
    return /^[a-f\d]{24}$/i.test(senderId) ? `d:${senderId}` : null
  }

  if (/^[a-f\d]{24}$/i.test(groupId)) return `g:${groupId}`

  if (isGroup) {
    const synthetic = room || department || 'Team'
    return `g:${synthetic}`
  }

  return null
}

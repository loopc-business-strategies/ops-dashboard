import { describe, it, expect } from 'vitest'
import { resolveChatTargetIdFromSocketPayload } from './notificationChatTarget'

describe('resolveChatTargetIdFromSocketPayload', () => {
  it('resolves DM from senderId', () => {
    const id = '507f1f77bcf86cd799439012'
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'chat_message',
        data: { channelType: 'dm', senderId: id, senderName: 'A' },
      }),
    ).toBe(`d:${id}`)
  })

  it('accepts direct as DM alias', () => {
    const id = '507f1f77bcf86cd799439012'
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'chat_mention',
        data: { channelType: 'direct', senderId: id },
      }),
    ).toBe(`d:${id}`)
  })

  it('resolves group by Mongo groupId', () => {
    const gid = '507f1f77bcf86cd799439099'
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'chat_message',
        data: { channelType: 'group', groupId: gid, room: 'Lobby' },
      }),
    ).toBe(`g:${gid}`)
  })

  it('resolves legacy group without groupId using room (matches ChatTab)', () => {
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'chat_message',
        data: { channelType: 'group', groupId: '', room: 'Production Team' },
      }),
    ).toBe('g:Production Team')
  })

  it('falls back to department then Team for synthetic group id', () => {
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'chat_message',
        data: { channelType: 'group', groupId: '', room: '', department: 'finance' },
      }),
    ).toBe('g:finance')
  })

  it('returns null for unrelated notification types', () => {
    expect(
      resolveChatTargetIdFromSocketPayload({
        type: 'transaction_approved',
        data: {},
      }),
    ).toBeNull()
  })
})

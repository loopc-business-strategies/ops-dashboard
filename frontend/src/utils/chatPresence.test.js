import { describe, expect, it } from 'vitest'
import { countOnlineMembers, createOnlineLookup } from './chatPresence'

describe('chatPresence', () => {
  it('uses live onlineUserIds over participant snapshot', () => {
    const isUserOnline = createOnlineLookup(['user-b'], [
      { _id: 'user-a', isOnline: true },
      { _id: 'user-b', isOnline: false },
    ])

    expect(isUserOnline('user-a')).toBe(true)
    expect(isUserOnline('user-b')).toBe(true)
    expect(isUserOnline('user-c')).toBe(false)
  })

  it('counts online group members', () => {
    const isUserOnline = createOnlineLookup(['1', '3'], [])
    expect(countOnlineMembers(['1', '2', '3'], isUserOnline)).toBe(2)
  })
})

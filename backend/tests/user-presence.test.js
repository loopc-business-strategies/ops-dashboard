const { resetLocalCoordinationForTests } = require('../utils/sharedCoordination')
const {
  registerConnection,
  unregisterConnection,
  getOnlineUserIds,
  isUserOnline,
  resetPresenceForTests,
} = require('../services/userPresence')

describe('user presence', () => {
  beforeEach(async () => {
    resetLocalCoordinationForTests()
    await resetPresenceForTests()
  })

  test('marks user online on first connection and offline after last disconnect', async () => {
    const tenant = 'loopc'
    const userId = 'user-a'

    const first = await registerConnection(tenant, userId)
    expect(first.becameOnline).toBe(true)
    expect(first.totalHits).toBe(1)
    expect(await isUserOnline(tenant, userId)).toBe(true)
    expect(await getOnlineUserIds(tenant)).toEqual([userId])

    const second = await registerConnection(tenant, userId)
    expect(second.becameOnline).toBe(false)
    expect(second.totalHits).toBe(2)

    const firstDisconnect = await unregisterConnection(tenant, userId)
    expect(firstDisconnect.becameOffline).toBe(false)
    expect(await isUserOnline(tenant, userId)).toBe(true)

    const secondDisconnect = await unregisterConnection(tenant, userId)
    expect(secondDisconnect.becameOffline).toBe(true)
    expect(await isUserOnline(tenant, userId)).toBe(false)
    expect(await getOnlineUserIds(tenant)).toEqual([])
  })
})

import { useSyncExternalStore } from 'react'
import { getOnlineUserIds, subscribeOnlineUserIds } from '../utils/presenceStore'

export function useOnlineUserIds() {
  return useSyncExternalStore(subscribeOnlineUserIds, getOnlineUserIds, getOnlineUserIds)
}

export default useOnlineUserIds

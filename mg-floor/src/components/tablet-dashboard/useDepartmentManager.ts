import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDepartmentManagers, saveDepartmentManager } from '@/src/api/departmentManagers'
import { toApiError } from '@/src/api/errors'
import { cacheManagers, getCachedManagers, type AssignedManager } from '@/src/auth/floorDashboardPrefs'

/** The department's assigned manager, saved on the server and shared by every tablet in that department. */
export function useDepartmentManager({ token, department }: { token: string | null; department: string }) {
  const [managers, setManagers] = useState<Record<string, AssignedManager>>({})
  const [canAssign, setCanAssign] = useState(false)
  const requestRef = useRef(0)

  useEffect(() => {
    getCachedManagers().then((cached) => setManagers((cur) => (Object.keys(cur).length ? cur : cached)))
  }, [])

  const reload = useCallback(async () => {
    if (!token) return
    const request = ++requestRef.current
    try {
      const res = await fetchDepartmentManagers()
      if (request !== requestRef.current) return
      setManagers(res.managers)
      setCanAssign(res.canAssign)
      cacheManagers(res.managers)
    } catch {
      // Offline: keep the last known managers.
    }
  }, [token])

  useEffect(() => {
    if (!token) setCanAssign(false)
    reload()
  }, [reload, token])

  /** Resolves to an error message, or null once saved. */
  const assign = useCallback(
    async (managerId: string | null): Promise<string | null> => {
      if (!department) return 'No floor department selected'
      try {
        const res = await saveDepartmentManager(department, managerId)
        setManagers((cur) => {
          const next = { ...cur }
          if (res.manager) next[department] = res.manager
          else delete next[department]
          return next
        })
        reload()
        return null
      } catch (err) {
        return toApiError(err).message || 'Could not save the manager'
      }
    },
    [department, reload],
  )

  return { manager: (department && managers[department]) || null, canAssign, reload, assign }
}

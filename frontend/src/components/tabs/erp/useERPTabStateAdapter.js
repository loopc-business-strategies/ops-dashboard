import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveAllowedErpSubTab } from '../../../utils/erpSubTabPermissions'

function buildErpPermissionKey(user) {
  try {
    return JSON.stringify({
      role: user?.role || '',
      allowedModules: user?.allowedModules || [],
      erp: user?.modulePermissions?.erp || null,
    })
  } catch {
    return String(user?.role || '')
  }
}

/**
 * Keeps ERP inner `activeTab` in sync with the shell `focusTab`, but only to tabs
 * the user may open. Blindly copying `focusTab` caused a ping-pong with the
 * permission clamp effect when `focusTab` was not allowed (Max update depth →
 * "This module failed to load" on Account Summary / enquiry).
 */
export function useERPTabStateAdapter(focusTab, user) {
  const userRef = useRef(user)
  userRef.current = user
  const erpPermissionKey = useMemo(() => buildErpPermissionKey(user), [user])

  const [activeTab, setActiveTab] = useState(() =>
    resolveAllowedErpSubTab(user, focusTab || 'dashboard', 'dashboard'),
  )

  useEffect(() => {
    if (!focusTab) return
    const allowed = resolveAllowedErpSubTab(userRef.current, focusTab, 'dashboard')
    setActiveTab((prev) => (allowed === prev ? prev : allowed))
  }, [focusTab, erpPermissionKey])

  return {
    activeTab,
    setActiveTab,
  }
}

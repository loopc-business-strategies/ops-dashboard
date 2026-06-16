import { useEffect, useState } from 'react'
import { resolveAllowedErpSubTab } from '../../../utils/erpSubTabPermissions'

/**
 * Keeps ERP inner `activeTab` in sync with the shell `focusTab`, but only to tabs
 * the user may open. Blindly copying `focusTab` caused a ping-pong with the
 * permission clamp effect when `focusTab` was not allowed (Max update depth →
 * "This module failed to load" on Account Summary / enquiry).
 */
export function useERPTabStateAdapter(focusTab, user) {
  const [activeTab, setActiveTab] = useState(() =>
    resolveAllowedErpSubTab(user, focusTab || 'dashboard', 'dashboard'),
  )

  useEffect(() => {
    if (!focusTab) return
    const allowed = resolveAllowedErpSubTab(user, focusTab, 'dashboard')
    setActiveTab((prev) => (allowed === prev ? prev : allowed))
  }, [focusTab, user])

  return {
    activeTab,
    setActiveTab,
  }
}

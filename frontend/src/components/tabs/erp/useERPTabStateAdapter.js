import { useEffect, useState } from 'react'

export function useERPTabStateAdapter(focusTab) {
  const [activeTab, setActiveTab] = useState(focusTab || 'dashboard')

  useEffect(() => {
    if (!focusTab) return
    setActiveTab((prev) => (prev === focusTab ? prev : focusTab))
  }, [focusTab])

  return {
    activeTab,
    setActiveTab,
  }
}

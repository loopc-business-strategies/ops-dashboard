import { useEffect, useState } from 'react'

export function useERPTabStateAdapter(focusTab) {
  const [activeTab, setActiveTab] = useState(focusTab || 'dashboard')

  useEffect(() => {
    // Always update if focusTab changes, even if it's the same value
    if (focusTab) {
      setActiveTab(focusTab)
    }
  }, [focusTab])

  return {
    activeTab,
    setActiveTab,
  }
}

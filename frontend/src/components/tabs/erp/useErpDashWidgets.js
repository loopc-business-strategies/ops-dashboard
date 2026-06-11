import { useEffect, useLayoutEffect, useState } from 'react'
import {
  ERP_DASH_DEFAULT,
  sanitizeDashWidgets,
  sanitizeDashWidgetsPreserveOrder,
} from '../erpTabConstants'

/**
 * Persists ERP dashboard widget layout to localStorage for the current user key.
 */
export function useErpDashWidgets({ dashStorageKey, dashEditMode }) {
  const [dashWidgets, setDashWidgets] = useState(() => [...ERP_DASH_DEFAULT])

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(dashStorageKey)
      setDashWidgets(sanitizeDashWidgets(raw ? JSON.parse(raw) : ERP_DASH_DEFAULT))
    } catch {
      setDashWidgets([...ERP_DASH_DEFAULT])
    }
  }, [dashStorageKey])

  useEffect(() => {
    try {
      const payload = dashEditMode ? sanitizeDashWidgetsPreserveOrder(dashWidgets) : sanitizeDashWidgets(dashWidgets)
      localStorage.setItem(dashStorageKey, JSON.stringify(payload))
    } catch {
      void 0
    }
  }, [dashWidgets, dashStorageKey, dashEditMode])

  return { dashWidgets, setDashWidgets }
}

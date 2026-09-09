import { useRef, useState } from 'react'
import { useErpDashWidgets } from './useErpDashWidgets'

/**
 * Arrange/customize UI state for the ERP dashboard widget grid.
 */
export function useErpDashUiState({ user, tenantKey = '' }) {
  const tenantPart = String(tenantKey || user?.company || user?.tenant || 'default').trim().toLowerCase()
  const dashStorageKey = `erp_dash_${tenantPart}_${user?.name || 'default'}`
  const [dashEditMode, setDashEditMode] = useState(false)
  const { dashWidgets, setDashWidgets } = useErpDashWidgets({ dashStorageKey, dashEditMode })
  const [dashHoveredWid, setDashHoveredWid] = useState(null)
  const [dashWidgetCols, setDashWidgetCols] = useState({})
  const [dashCustomizeOpen, setDashCustomizeOpen] = useState(false)
  const [dashPickSelected, setDashPickSelected] = useState([])
  const [dashExpandedWidget, setDashExpandedWidget] = useState(null)
  const dashDragSrc = useRef(null)

  return {
    dashStorageKey,
    dashEditMode,
    setDashEditMode,
    dashWidgets,
    setDashWidgets,
    dashHoveredWid,
    setDashHoveredWid,
    dashWidgetCols,
    setDashWidgetCols,
    dashCustomizeOpen,
    setDashCustomizeOpen,
    dashPickSelected,
    setDashPickSelected,
    dashExpandedWidget,
    setDashExpandedWidget,
    dashDragSrc,
  }
}

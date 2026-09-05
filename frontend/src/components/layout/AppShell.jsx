import React from 'react'

/**
 * Flex shell: optional edge sensor + sidebar slot + main content.
 * Keeps Dashboard orchestration logic outside presentation.
 */
export default function AppShell({
  isDesktop,
  isRTL,
  sidebarOpen,
  edgeTriggerWidth,
  onShellMouseMove,
  onEdgeEnter,
  sidebar,
  overlay,
  main,
}) {
  return (
    <div
      className="app-shell h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100vh' }}
      onMouseMove={onShellMouseMove}
    >
      {isDesktop && !sidebarOpen && (
        <div
          className={`fixed inset-y-0 z-40 ${isRTL ? 'right-0' : 'left-0'}`}
          style={{ width: edgeTriggerWidth }}
          onMouseEnter={onEdgeEnter}
          aria-hidden="true"
        />
      )}
      {sidebar}
      {overlay}
      {main}
    </div>
  )
}

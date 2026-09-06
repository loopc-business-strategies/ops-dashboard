import React from 'react'

/**
 * Flex shell: sidebar slot + main content.
 * Collapse is user-controlled (toggle / mobile drawer) — no edge-open or hover auto-hide.
 */
export default function AppShell({
  sidebar,
  overlay,
  main,
}) {
  return (
    <div
      className="app-shell h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100vh' }}
    >
      {sidebar}
      {overlay}
      {main}
    </div>
  )
}

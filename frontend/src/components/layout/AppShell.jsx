import React from 'react'

/**
 * Flex shell: sidebar slot + main content.
 * Desktop: hamburger pin toggle + edge hover open / mouseleave auto-hide (wired in Dashboard).
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

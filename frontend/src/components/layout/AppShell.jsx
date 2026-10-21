import React from 'react'

/**
 * Flex shell: sidebar slot + main content.
 * Desktop: hamburger pin toggle + edge hover open / mouseleave auto-hide (wired in Dashboard).
 *
 * Intentionally does NOT use useViewportBoardFit. Ops ERP is a scrollable app
 * (many dashboard widgets taller than 1080). Locking a 1920×1080 board shrunk
 * cards and clipped the bottom row. TV board-fit stays on login + production
 * control center only.
 */
export default function AppShell({
  sidebar,
  overlay,
  main,
}) {
  return (
    <div className="app-shell-viewport">
      <div
        className="app-shell h-screen overflow-hidden"
        style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100%', width: '100%', height: '100%' }}
      >
        {sidebar}
        {overlay}
        {main}
      </div>
    </div>
  )
}

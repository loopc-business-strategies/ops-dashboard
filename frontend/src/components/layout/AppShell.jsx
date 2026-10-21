import React, { useRef } from 'react'
import { useViewportBoardFit } from '../../hooks/useViewportBoardFit'

/**
 * Flex shell: sidebar slot + main content.
 * Desktop: hamburger pin toggle + edge hover open / mouseleave auto-hide (wired in Dashboard).
 * Scales a 1920×1080 board to any TV/PC viewport so ops UI fills the screen like a PC.
 */
export default function AppShell({
  sidebar,
  overlay,
  main,
}) {
  const shellRef = useRef(null)
  useViewportBoardFit(shellRef, { designWidth: 1920, designHeight: 1080 })

  return (
    <div className="app-shell-viewport">
      <div
        ref={shellRef}
        className="app-shell h-screen overflow-hidden"
        style={{ background: 'var(--bg-base)', display: 'flex', flexDirection: 'row', minHeight: '100%' }}
      >
        {sidebar}
        {overlay}
        {main}
      </div>
    </div>
  )
}

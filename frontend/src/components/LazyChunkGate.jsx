import { Component, Suspense, useEffect, useState } from 'react'
import { isStaleChunkError, reloadOnceForStaleChunk } from '../utils/staleChunkReload'

const DEFAULT_TIMEOUT_MS = 8000

export function TimedChunkFallback({
  label = 'Loading…',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  color = '#6B7280',
}) {
  const [showRetry, setShowRetry] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowRetry(true), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [timeoutMs])

  if (!showRetry) {
    return (
      <div style={{ padding: '1rem', color, fontSize: '0.875rem' }}>
        {label}
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', color, fontSize: '0.875rem' }}>
      <p style={{ margin: '0 0 0.75rem' }}>
        Still loading. The module may have failed after a deploy.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          padding: '0.4rem 0.85rem',
          borderRadius: 8,
          border: '1px solid #D1D5DB',
          background: '#FFFFFF',
          color: '#1C2A33',
          cursor: 'pointer',
          fontSize: '0.8125rem',
        }}
      >
        Retry
      </button>
    </div>
  )
}

export class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error) {
    if (isStaleChunkError(error)) {
      reloadOnceForStaleChunk()
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleRetry = () => {
    const { error } = this.state
    if (isStaleChunkError(error)) {
      window.location.reload()
      return
    }
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      const color = this.props.color || '#6B7280'
      return (
        <div style={{ padding: '1rem', color, fontSize: '0.875rem' }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#1C2A33' }}>
            This module failed to load.
          </p>
          <p style={{ margin: '8px 0 12px', color }}>
            Switch tabs or retry. After a deploy, a full reload usually fixes this.
          </p>
          {this.state.error?.message ? (
            <p style={{ margin: '0 0 12px', fontSize: 12, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word', color: '#9CA3AF' }}>
              {this.state.error.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 8,
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#1C2A33',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Suspense + chunk error recovery for nested lazy tabs (e.g. VoucherTab).
 */
export default function LazyChunkGate({
  children,
  label = 'Loading…',
  color = '#6B7280',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  resetKey = 0,
  onRetry,
}) {
  return (
    <ChunkErrorBoundary resetKey={resetKey} color={color} onRetry={onRetry}>
      <Suspense
        fallback={(
          <TimedChunkFallback
            label={label}
            color={color}
            timeoutMs={timeoutMs}
          />
        )}
      >
        {children}
      </Suspense>
    </ChunkErrorBoundary>
  )
}

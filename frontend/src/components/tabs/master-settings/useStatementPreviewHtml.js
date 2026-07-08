import { useEffect, useState } from 'react'
import { buildStatementPreviewHtml } from '../erp/statementPreviewSamples'

export function useStatementPreviewHtml({ branding, user, previewMode = 'empty' }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Statement of Account')
  const [accountCode, setAccountCode] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await buildStatementPreviewHtml({
          mode: previewMode,
          branding,
          user,
        })
        if (cancelled) return
        setHtml(result.html)
        setTitle(result.title)
        setAccountCode(result.accountCode)
      } catch (e) {
        if (cancelled) return
        setHtml('')
        setError(e?.message || 'Failed to build statement preview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [branding, user, previewMode])

  return {
    html,
    loading,
    error,
    title,
    accountCode,
  }
}

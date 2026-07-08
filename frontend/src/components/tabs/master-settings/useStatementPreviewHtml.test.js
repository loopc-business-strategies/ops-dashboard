import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStatementPreviewHtml } from './useStatementPreviewHtml'

vi.mock('../erp/statementPreviewSamples', () => ({
  buildStatementPreviewHtml: vi.fn(async ({ mode }) => ({
    html: `<html><body>${mode}-statement</body></html>`,
    title: `Statement — CUST-001 (${mode})`,
    accountCode: 'CUST-001',
  })),
}))

describe('useStatementPreviewHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads preview HTML for the selected mode', async () => {
    const { result, rerender } = renderHook(
      ({ previewMode }) => useStatementPreviewHtml({
        branding: { statementPrint: { title: 'Statement of Account' } },
        user: { company: 'loopc' },
        previewMode,
      }),
      { initialProps: { previewMode: 'empty' } },
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.html).toContain('empty-statement')
    })

    rerender({ previewMode: 'sample' })
    await waitFor(() => {
      expect(result.current.html).toContain('sample-statement')
      expect(result.current.title).toContain('Statement')
    })
  })
})

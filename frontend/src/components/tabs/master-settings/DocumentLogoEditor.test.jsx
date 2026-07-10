import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import DocumentLogoEditor from './DocumentLogoEditor'

vi.mock('../erp/ERPBrandingUtils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    isSupportedLogoUpload: () => true,
    normalizeLogoDataUrl: vi.fn(),
    normalizeLogoUploadToDataUrl: vi.fn(),
  }
})

vi.mock('./documentLogoChange', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadImageNaturalSize: vi.fn(),
  }
})

import { normalizeLogoUploadToDataUrl } from '../erp/ERPBrandingUtils'
import { loadImageNaturalSize } from './documentLogoChange'

describe('DocumentLogoEditor upload sizing', () => {
  beforeEach(() => {
    vi.mocked(normalizeLogoUploadToDataUrl).mockResolvedValue('data:image/png;base64,uploaded')
    vi.mocked(loadImageNaturalSize).mockResolvedValue({ width: 500, height: 500 })
  })

  it('sets auto-sized logo dimensions on upload', async () => {
    const onChange = vi.fn()

    render(
      <DocumentLogoEditor
        branding={{ logoUrl: '', logoWidth: 180, logoHeight: 56, logoFit: 'contain' }}
        onChange={onChange}
        enableAutoLogoCleanup
      />,
    )

    const input = document.querySelector('input[type="file"]')
    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        logoUrl: 'data:image/png;base64,uploaded',
        logoWidth: 120,
        logoHeight: 120,
        logoFit: 'contain',
      })
    })
  })
})

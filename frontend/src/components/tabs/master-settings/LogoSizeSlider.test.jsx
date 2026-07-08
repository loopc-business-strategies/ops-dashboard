import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LogoSizeSlider from './LogoSizeSlider'

describe('LogoSizeSlider', () => {
  it('calls onChange with larger dimensions when slider moves up', () => {
    const onChange = vi.fn()
    render(
      <LogoSizeSlider
        branding={{ logoUrl: 'data:image/png;base64,abc', logoWidth: 180, logoHeight: 56 }}
        onChange={onChange}
      />,
    )

    const slider = screen.getByRole('slider', { name: 'Logo size' })
    fireEvent.change(slider, { target: { value: '125' } })

    expect(onChange).toHaveBeenCalledWith({ logoWidth: 225, logoHeight: 70 })
  })

  it('resets to default dimensions', () => {
    const onChange = vi.fn()
    render(
      <LogoSizeSlider
        branding={{ logoUrl: 'data:image/png;base64,abc', logoWidth: 225, logoHeight: 70 }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onChange).toHaveBeenCalledWith({ logoWidth: 180, logoHeight: 56 })
  })

  it('disables slider when no logo is uploaded', () => {
    render(
      <LogoSizeSlider
        branding={{ logoUrl: '', logoWidth: 180, logoHeight: 56 }}
        onChange={vi.fn()}
        disabled
      />,
    )

    expect(screen.getByRole('slider', { name: 'Logo size' }).disabled).toBe(true)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StatementTypographyControl from './StatementTypographyControl'

describe('StatementTypographyControl', () => {
  it('updates value from slider and number input', () => {
    const onChange = vi.fn()
    render(
      <StatementTypographyControl
        label="Company name size"
        value={15}
        min={10}
        max={28}
        defaultValue={15}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Company name size'), { target: { value: '18' } })
    expect(onChange).toHaveBeenCalledWith(18)

    fireEvent.change(screen.getByLabelText('Company name size in pixels'), { target: { value: '13' } })
    expect(onChange).toHaveBeenCalledWith(13)
  })

  it('resets to default value', () => {
    const onChange = vi.fn()
    render(
      <StatementTypographyControl
        label="Address size"
        value={12}
        min={8}
        max={16}
        defaultValue={10}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })
})
